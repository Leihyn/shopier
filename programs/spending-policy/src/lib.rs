use anchor_lang::prelude::*;

declare_id!("2S7hJm57s4VBmBBpqe59XFFibKR9L2ykstMCm8xWreRt");

const SECS_PER_DAY: i64 = 86_400;

#[program]
pub mod spending_policy {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        max_per_tx: u64,
        max_daily: u64,
        auto_approve_under: u64,
        secondhand_first: bool,
    ) -> Result<()> {
        require!(max_per_tx > 0, ShopierError::InvalidPolicy);
        require!(max_daily >= max_per_tx, ShopierError::InvalidPolicy);
        require!(auto_approve_under <= max_per_tx, ShopierError::InvalidPolicy);

        let policy = &mut ctx.accounts.policy;
        policy.owner = ctx.accounts.owner.key();
        policy.max_per_tx = max_per_tx;
        policy.max_daily = max_daily;
        policy.auto_approve_under = auto_approve_under;
        policy.secondhand_first = secondhand_first;
        policy.bump = ctx.bumps.policy;

        let daily = &mut ctx.accounts.daily;
        daily.spent = 0;
        daily.last_reset_unix = Clock::get()?.unix_timestamp;
        daily.bump = ctx.bumps.daily;

        emit!(PolicyInitialized {
            owner: policy.owner,
            max_per_tx,
            max_daily,
        });
        Ok(())
    }

    /// Read-only check. Validates the spend against hard limits and rolling daily.
    /// Returns true if amount <= auto-approve threshold. Does NOT mutate counters.
    pub fn check_spend(ctx: Context<CheckSpend>, amount: u64) -> Result<bool> {
        require!(amount > 0, ShopierError::ZeroAmount);
        let policy = &ctx.accounts.policy;
        require_keys_eq!(policy.owner, ctx.accounts.owner.key(), ShopierError::Unauthorized);
        require!(amount <= policy.max_per_tx, ShopierError::ExceedsMaxPerTx);

        let daily = &ctx.accounts.daily;
        let now = Clock::get()?.unix_timestamp;
        let effective_spent = if now - daily.last_reset_unix > SECS_PER_DAY {
            0
        } else {
            daily.spent
        };
        require!(
            effective_spent.checked_add(amount).ok_or(ShopierError::Overflow)? <= policy.max_daily,
            ShopierError::ExceedsDailyLimit
        );

        Ok(amount <= policy.auto_approve_under)
    }

    /// Record a settled spend. Auth-gated to owner. Re-validates limits.
    pub fn record_spend(ctx: Context<RecordSpend>, amount: u64) -> Result<()> {
        require!(amount > 0, ShopierError::ZeroAmount);
        let policy = &ctx.accounts.policy;
        require_keys_eq!(policy.owner, ctx.accounts.owner.key(), ShopierError::Unauthorized);
        require!(amount <= policy.max_per_tx, ShopierError::ExceedsMaxPerTx);

        let daily = &mut ctx.accounts.daily;
        let now = Clock::get()?.unix_timestamp;
        if now - daily.last_reset_unix > SECS_PER_DAY {
            daily.spent = 0;
            daily.last_reset_unix = now;
        }
        daily.spent = daily
            .spent
            .checked_add(amount)
            .ok_or(ShopierError::Overflow)?;
        require!(daily.spent <= policy.max_daily, ShopierError::ExceedsDailyLimit);

        emit!(SpendRecorded {
            owner: policy.owner,
            amount,
            daily_total: daily.spent,
        });
        Ok(())
    }

    pub fn update_policy(
        ctx: Context<UpdatePolicy>,
        max_per_tx: u64,
        max_daily: u64,
        auto_approve_under: u64,
        secondhand_first: bool,
    ) -> Result<()> {
        require!(max_per_tx > 0, ShopierError::InvalidPolicy);
        require!(max_daily >= max_per_tx, ShopierError::InvalidPolicy);
        require!(auto_approve_under <= max_per_tx, ShopierError::InvalidPolicy);

        let policy = &mut ctx.accounts.policy;
        require_keys_eq!(policy.owner, ctx.accounts.owner.key(), ShopierError::Unauthorized);
        policy.max_per_tx = max_per_tx;
        policy.max_daily = max_daily;
        policy.auto_approve_under = auto_approve_under;
        policy.secondhand_first = secondhand_first;
        Ok(())
    }

    /// Owner-signed. Registers a session key as a delegate that can sign
    /// purchases under its own (tighter) bounds without owner re-signing.
    /// Delegate bounds must be <= owner's bounds. Auto-expires.
    pub fn set_delegate(
        ctx: Context<SetDelegate>,
        delegate: Pubkey,
        max_per_tx: u64,
        max_daily: u64,
        expires_at: i64,
    ) -> Result<()> {
        let policy = &ctx.accounts.policy;
        require_keys_eq!(policy.owner, ctx.accounts.owner.key(), ShopierError::Unauthorized);
        require!(max_per_tx > 0, ShopierError::InvalidPolicy);
        require!(max_daily >= max_per_tx, ShopierError::InvalidPolicy);
        require!(max_per_tx <= policy.max_per_tx, ShopierError::DelegateExceedsOwnerBound);
        require!(max_daily <= policy.max_daily, ShopierError::DelegateExceedsOwnerBound);

        let now = Clock::get()?.unix_timestamp;
        let max_expiry = now + 7 * SECS_PER_DAY;
        require!(
            expires_at > now && expires_at <= max_expiry,
            ShopierError::InvalidExpiry
        );

        let d = &mut ctx.accounts.delegation;
        d.owner = policy.owner;
        d.delegate = delegate;
        d.max_per_tx = max_per_tx;
        d.max_daily = max_daily;
        d.expires_at = expires_at;
        d.spent_today = 0;
        d.last_reset_unix = now;
        d.bump = ctx.bumps.delegation;

        emit!(DelegateSet {
            owner: policy.owner,
            delegate,
            max_per_tx,
            max_daily,
            expires_at,
        });
        Ok(())
    }

    /// Owner-signed. Closes the delegation account and refunds rent.
    pub fn revoke_delegate(ctx: Context<RevokeDelegate>) -> Result<()> {
        let policy = &ctx.accounts.policy;
        require_keys_eq!(policy.owner, ctx.accounts.owner.key(), ShopierError::Unauthorized);
        emit!(DelegateRevoked { owner: policy.owner });
        Ok(())
    }

    /// Delegate-signed. Records a spend, validating against BOTH the
    /// delegation bounds AND the master spending policy. Advances both
    /// counters atomically — the master daily counter is the absolute ceiling.
    pub fn record_spend_as_delegate(
        ctx: Context<RecordSpendAsDelegate>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ShopierError::ZeroAmount);

        let policy = &ctx.accounts.policy;
        let d = &mut ctx.accounts.delegation;
        require_keys_eq!(d.delegate, ctx.accounts.delegate.key(), ShopierError::Unauthorized);

        let now = Clock::get()?.unix_timestamp;
        require!(now < d.expires_at, ShopierError::DelegateExpired);

        // Bound 1: delegate's per-tx
        require!(amount <= d.max_per_tx, ShopierError::DelegateExceedsPerTx);

        // Bound 2: master per-tx (defense in depth)
        require!(amount <= policy.max_per_tx, ShopierError::ExceedsMaxPerTx);

        // Bound 3: delegate's daily
        if now - d.last_reset_unix > SECS_PER_DAY {
            d.spent_today = 0;
            d.last_reset_unix = now;
        }
        let new_delegate_total = d
            .spent_today
            .checked_add(amount)
            .ok_or(ShopierError::Overflow)?;
        require!(new_delegate_total <= d.max_daily, ShopierError::DelegateExceedsDaily);

        // Bound 4: master daily — the absolute ceiling
        let master = &mut ctx.accounts.daily;
        if now - master.last_reset_unix > SECS_PER_DAY {
            master.spent = 0;
            master.last_reset_unix = now;
        }
        let new_master_total = master
            .spent
            .checked_add(amount)
            .ok_or(ShopierError::Overflow)?;
        require!(
            new_master_total <= policy.max_daily,
            ShopierError::ExceedsDailyLimit
        );

        // Commit both counters atomically
        d.spent_today = new_delegate_total;
        master.spent = new_master_total;

        emit!(DelegateSpendRecorded {
            owner: policy.owner,
            delegate: d.delegate,
            amount,
            delegate_daily_total: d.spent_today,
            master_daily_total: master.spent,
        });
        Ok(())
    }
}

#[account]
pub struct PolicyConfig {
    pub owner: Pubkey,
    pub max_per_tx: u64,
    pub max_daily: u64,
    pub auto_approve_under: u64,
    pub secondhand_first: bool,
    pub bump: u8,
}

impl PolicyConfig {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[account]
pub struct DailyState {
    pub spent: u64,
    pub last_reset_unix: i64,
    pub bump: u8,
}

impl DailyState {
    pub const SIZE: usize = 8 + 8 + 8 + 1;
}

/// Per-owner delegation record. Created by set_delegate, closed by revoke_delegate.
/// Holds the session key, its tighter bounds, expiry, and its own daily counter.
#[account]
pub struct Delegation {
    pub owner: Pubkey,        // 32 — the policy owner who created this
    pub delegate: Pubkey,     // 32 — the session key
    pub max_per_tx: u64,      // 8
    pub max_daily: u64,       // 8
    pub expires_at: i64,      // 8
    pub spent_today: u64,     // 8
    pub last_reset_unix: i64, // 8
    pub bump: u8,             // 1
}

impl Delegation {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = PolicyConfig::SIZE,
        seeds = [b"policy", owner.key().as_ref()],
        bump,
    )]
    pub policy: Account<'info, PolicyConfig>,

    #[account(
        init,
        payer = owner,
        space = DailyState::SIZE,
        seeds = [b"daily", owner.key().as_ref()],
        bump,
    )]
    pub daily: Account<'info, DailyState>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckSpend<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, PolicyConfig>,

    #[account(
        seeds = [b"daily", owner.key().as_ref()],
        bump = daily.bump,
    )]
    pub daily: Account<'info, DailyState>,
}

#[derive(Accounts)]
pub struct RecordSpend<'info> {
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, PolicyConfig>,

    #[account(
        mut,
        seeds = [b"daily", owner.key().as_ref()],
        bump = daily.bump,
    )]
    pub daily: Account<'info, DailyState>,
}

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, PolicyConfig>,
}

#[derive(Accounts)]
pub struct SetDelegate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, PolicyConfig>,

    #[account(
        init_if_needed,
        payer = owner,
        space = Delegation::SIZE,
        seeds = [b"delegation", owner.key().as_ref()],
        bump,
    )]
    pub delegation: Account<'info, Delegation>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeDelegate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, PolicyConfig>,

    #[account(
        mut,
        close = owner,
        seeds = [b"delegation", owner.key().as_ref()],
        bump = delegation.bump,
    )]
    pub delegation: Account<'info, Delegation>,
}

#[derive(Accounts)]
pub struct RecordSpendAsDelegate<'info> {
    /// The session key actually signing this transaction.
    pub delegate: Signer<'info>,

    /// CHECK: owner pubkey is read from delegation; we use it only for PDA derivation
    /// and never trust it as a signer. Bound by `address = delegation.owner`.
    #[account(address = delegation.owner)]
    pub owner: AccountInfo<'info>,

    #[account(
        seeds = [b"policy", owner.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, PolicyConfig>,

    #[account(
        mut,
        seeds = [b"daily", owner.key().as_ref()],
        bump = daily.bump,
    )]
    pub daily: Account<'info, DailyState>,

    #[account(
        mut,
        seeds = [b"delegation", owner.key().as_ref()],
        bump = delegation.bump,
    )]
    pub delegation: Account<'info, Delegation>,
}

#[event]
pub struct PolicyInitialized {
    pub owner: Pubkey,
    pub max_per_tx: u64,
    pub max_daily: u64,
}

#[event]
pub struct SpendRecorded {
    pub owner: Pubkey,
    pub amount: u64,
    pub daily_total: u64,
}

#[event]
pub struct DelegateSet {
    pub owner: Pubkey,
    pub delegate: Pubkey,
    pub max_per_tx: u64,
    pub max_daily: u64,
    pub expires_at: i64,
}

#[event]
pub struct DelegateRevoked {
    pub owner: Pubkey,
}

#[event]
pub struct DelegateSpendRecorded {
    pub owner: Pubkey,
    pub delegate: Pubkey,
    pub amount: u64,
    pub delegate_daily_total: u64,
    pub master_daily_total: u64,
}

#[error_code]
pub enum ShopierError {
    #[msg("Caller is not the policy owner")]
    Unauthorized,
    #[msg("Amount must be positive")]
    ZeroAmount,
    #[msg("Amount exceeds max per transaction")]
    ExceedsMaxPerTx,
    #[msg("Amount would exceed daily spending limit")]
    ExceedsDailyLimit,
    #[msg("Invalid policy parameters")]
    InvalidPolicy,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Delegate bound exceeds owner bound")]
    DelegateExceedsOwnerBound,
    #[msg("Delegation has expired")]
    DelegateExpired,
    #[msg("Amount exceeds delegate per-tx limit")]
    DelegateExceedsPerTx,
    #[msg("Amount would exceed delegate daily limit")]
    DelegateExceedsDaily,
    #[msg("Invalid expiry — must be in future and within 7 days")]
    InvalidExpiry,
}
