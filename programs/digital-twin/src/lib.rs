use anchor_lang::prelude::*;

declare_id!("Dt3SWQmsAT1vDJyPRCPgMPXi2Rg47niXDVUzo6boFBCU");

#[program]
pub mod digital_twin {
    use super::*;

    pub fn create_twin(ctx: Context<CreateTwin>, params: TwinParams) -> Result<()> {
        validate(&params)?;
        let twin = &mut ctx.accounts.twin;
        twin.owner = ctx.accounts.owner.key();
        copy_params(twin, &params);
        twin.created_at = Clock::get()?.unix_timestamp;
        twin.updated_at = twin.created_at;
        twin.bump = ctx.bumps.twin;
        emit!(TwinCreated { owner: twin.owner });
        Ok(())
    }

    pub fn update_twin(ctx: Context<UpdateTwin>, params: TwinParams) -> Result<()> {
        validate(&params)?;
        let twin = &mut ctx.accounts.twin;
        require_keys_eq!(twin.owner, ctx.accounts.owner.key(), TwinError::Unauthorized);
        copy_params(twin, &params);
        twin.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn delete_twin(ctx: Context<DeleteTwin>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.twin.owner,
            ctx.accounts.owner.key(),
            TwinError::Unauthorized
        );
        Ok(())
    }

    /// Treasury-callable. Creates an empty EncryptedTwin PDA on behalf of `user`.
    /// The user has not yet signed; only the rent-paying treasury signs here.
    /// Body data is NOT written — that requires a separate user-signed call.
    pub fn init_pending_twin(ctx: Context<InitPendingTwin>, user: Pubkey) -> Result<()> {
        let twin = &mut ctx.accounts.twin;
        twin.owner = user;
        twin.state = TwinState::Pending;
        twin.encrypted_blob = Vec::new();
        twin.nonce = [0u8; 24];
        twin.created_at = Clock::get()?.unix_timestamp;
        twin.updated_at = twin.created_at;
        twin.bump = ctx.bumps.twin;
        emit!(PendingTwinCreated {
            owner: user,
            paymaster: ctx.accounts.paymaster.key(),
        });
        Ok(())
    }

    /// User-callable. Fills in encrypted body data on a pending twin.
    /// The blob is opaque to the chain — encryption/decryption happens client-side
    /// using a key derived from the user's wallet signature.
    pub fn complete_twin_encrypted(
        ctx: Context<CompleteTwinEncrypted>,
        blob: Vec<u8>,
        nonce: [u8; 24],
    ) -> Result<()> {
        require!(blob.len() <= EncryptedTwin::MAX_BLOB, TwinError::BlobTooLarge);
        let twin = &mut ctx.accounts.twin;
        require_keys_eq!(twin.owner, ctx.accounts.owner.key(), TwinError::Unauthorized);
        twin.encrypted_blob = blob;
        twin.nonce = nonce;
        twin.state = TwinState::Encrypted;
        twin.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// User-callable. Replaces the encrypted blob (rotation, edits).
    pub fn update_twin_encrypted(
        ctx: Context<UpdateTwinEncrypted>,
        blob: Vec<u8>,
        nonce: [u8; 24],
    ) -> Result<()> {
        require!(blob.len() <= EncryptedTwin::MAX_BLOB, TwinError::BlobTooLarge);
        let twin = &mut ctx.accounts.twin;
        require_keys_eq!(twin.owner, ctx.accounts.owner.key(), TwinError::Unauthorized);
        require!(
            twin.state != TwinState::Pending,
            TwinError::PendingTwinNotInitialized
        );
        twin.encrypted_blob = blob;
        twin.nonce = nonce;
        twin.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Owner-callable. Upserts a WatchPolicy: which celebs the agent should
    /// monitor for the user, with section/register filters and an auto-buy mode.
    /// The financial cap (max-per-look) is enforced here as a watch-level cap;
    /// the global per-day cap lives in spending_policy and applies separately.
    pub fn set_watch_policy(
        ctx: Context<SetWatchPolicy>,
        celebs: Vec<String>,
        section_filter: u8,
        register_filter: u8,
        mode: u8,
        max_per_look_usd: u64,
        event_scope: Option<String>,
    ) -> Result<()> {
        require!(celebs.len() <= WatchPolicy::MAX_CELEBS, TwinError::TooManyCelebs);
        for c in &celebs {
            require!(c.len() <= 32, TwinError::CelebSlugTooLong);
        }
        require!(section_filter <= 4, TwinError::InvalidWatchFilter);
        require!(register_filter <= 3, TwinError::InvalidWatchFilter);
        require!(mode <= 2, TwinError::InvalidWatchMode);
        require!(max_per_look_usd > 0 && max_per_look_usd <= 1_000_000, TwinError::InvalidWatchCap);
        if let Some(ref s) = event_scope {
            require!(s.len() <= 32, TwinError::EventScopeTooLong);
        }

        let watch = &mut ctx.accounts.watch;
        let now = Clock::get()?.unix_timestamp;
        if watch.owner == Pubkey::default() {
            watch.owner = ctx.accounts.owner.key();
            watch.created_at = now;
            watch.bump = ctx.bumps.watch;
        }
        watch.celebs = celebs;
        watch.section_filter = section_filter;
        watch.register_filter = register_filter;
        watch.mode = mode;
        watch.max_per_look_usd = max_per_look_usd;
        watch.event_scope = event_scope;
        watch.updated_at = now;
        emit!(WatchPolicySet {
            owner: watch.owner,
            celeb_count: watch.celebs.len() as u8,
            mode,
            max_per_look_usd,
        });
        Ok(())
    }

    /// Owner-callable. Closes the WatchPolicy PDA and refunds rent.
    pub fn clear_watch_policy(ctx: Context<ClearWatchPolicy>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.watch.owner,
            ctx.accounts.owner.key(),
            TwinError::Unauthorized
        );
        emit!(WatchPolicyCleared { owner: ctx.accounts.owner.key() });
        Ok(())
    }
}

fn validate(p: &TwinParams) -> Result<()> {
    require!(p.height_cm >= 100 && p.height_cm <= 250, TwinError::InvalidMeasurement);
    require!(p.weight_kg >= 30 && p.weight_kg <= 250, TwinError::InvalidMeasurement);
    require!(p.chest_cm >= 50 && p.chest_cm <= 200, TwinError::InvalidMeasurement);
    require!(p.waist_cm >= 40 && p.waist_cm <= 200, TwinError::InvalidMeasurement);
    require!(p.style_prefs.len() <= 256, TwinError::InvalidMeasurement);
    require!(p.fav_colors.len() <= 128, TwinError::InvalidMeasurement);
    require!(p.skin_tone >= 1 && p.skin_tone <= 10, TwinError::InvalidMeasurement);
    Ok(())
}

fn copy_params(t: &mut Twin, p: &TwinParams) {
    t.height_cm = p.height_cm;
    t.weight_kg = p.weight_kg;
    t.chest_cm = p.chest_cm;
    t.waist_cm = p.waist_cm;
    t.hip_cm = p.hip_cm;
    t.inseam_cm = p.inseam_cm;
    t.shoulder_cm = p.shoulder_cm;
    t.undertone = p.undertone;
    t.skin_tone = p.skin_tone;
    t.style_prefs = p.style_prefs.clone();
    t.fav_colors = p.fav_colors.clone();
}

#[account]
pub struct Twin {
    pub owner: Pubkey,
    pub height_cm: u16,
    pub weight_kg: u16,
    pub chest_cm: u16,
    pub waist_cm: u16,
    pub hip_cm: u16,
    pub inseam_cm: u16,
    pub shoulder_cm: u16,
    pub undertone: Undertone,
    pub skin_tone: u8,
    pub style_prefs: String,
    pub fav_colors: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl Twin {
    pub const SIZE: usize = 8 + 32 + (7 * 2) + 1 + 1 + (4 + 256) + (4 + 128) + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Undertone {
    Cool,
    Warm,
    Neutral,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TwinParams {
    pub height_cm: u16,
    pub weight_kg: u16,
    pub chest_cm: u16,
    pub waist_cm: u16,
    pub hip_cm: u16,
    pub inseam_cm: u16,
    pub shoulder_cm: u16,
    pub undertone: Undertone,
    pub skin_tone: u8,
    pub style_prefs: String,
    pub fav_colors: String,
}

#[derive(Accounts)]
pub struct CreateTwin<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = Twin::SIZE,
        seeds = [b"twin", owner.key().as_ref()],
        bump,
    )]
    pub twin: Account<'info, Twin>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateTwin<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"twin", owner.key().as_ref()],
        bump = twin.bump,
    )]
    pub twin: Account<'info, Twin>,
}

#[derive(Accounts)]
pub struct DeleteTwin<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [b"twin", owner.key().as_ref()],
        bump = twin.bump,
    )]
    pub twin: Account<'info, Twin>,
}

#[event]
pub struct TwinCreated {
    pub owner: Pubkey,
}

#[event]
pub struct PendingTwinCreated {
    pub owner: Pubkey,
    pub paymaster: Pubkey,
}

#[account]
pub struct EncryptedTwin {
    pub owner: Pubkey,
    pub state: TwinState,
    pub encrypted_blob: Vec<u8>,
    pub nonce: [u8; 24],
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl EncryptedTwin {
    pub const MAX_BLOB: usize = 1024;
    // 8 disc + 32 owner + 1 state + (4 + MAX_BLOB) blob + 24 nonce + 8 + 8 + 1
    pub const SIZE: usize = 8 + 32 + 1 + 4 + Self::MAX_BLOB + 24 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TwinState {
    Pending,
    Encrypted,
}

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct InitPendingTwin<'info> {
    #[account(mut)]
    pub paymaster: Signer<'info>,

    #[account(
        init,
        payer = paymaster,
        space = EncryptedTwin::SIZE,
        seeds = [b"twin_v2", user.as_ref()],
        bump,
    )]
    pub twin: Account<'info, EncryptedTwin>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CompleteTwinEncrypted<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"twin_v2", owner.key().as_ref()],
        bump = twin.bump,
    )]
    pub twin: Account<'info, EncryptedTwin>,
}

#[derive(Accounts)]
pub struct UpdateTwinEncrypted<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"twin_v2", owner.key().as_ref()],
        bump = twin.bump,
    )]
    pub twin: Account<'info, EncryptedTwin>,
}

#[error_code]
pub enum TwinError {
    #[msg("Caller is not the twin owner")]
    Unauthorized,
    #[msg("Measurement out of plausible range")]
    InvalidMeasurement,
    #[msg("Encrypted blob exceeds maximum size")]
    BlobTooLarge,
    #[msg("Pending twin must be completed before update")]
    PendingTwinNotInitialized,
    #[msg("Watch policy exceeds celeb cap")]
    TooManyCelebs,
    #[msg("Celeb slug exceeds 32 chars")]
    CelebSlugTooLong,
    #[msg("Watch filter byte out of range")]
    InvalidWatchFilter,
    #[msg("Watch mode must be 0..=2")]
    InvalidWatchMode,
    #[msg("Watch cap must be > 0 and <= 1,000,000 USD")]
    InvalidWatchCap,
    #[msg("Event scope exceeds 32 chars")]
    EventScopeTooLong,
}

// =============================================================================
// WatchPolicy — on-chain primitive that backs auto-buy trust bounds.
// =============================================================================
//
// One PDA per (owner) seeded `["watch", owner]`. Holds the user's choice of
// celebs to monitor, section/register filters, an auto-buy mode flag, and a
// per-look USD ceiling. The off-chain cron + matcher reads this account to
// decide which inbox entries to materialize. The session-key delegate reads
// `max_per_look_usd` as the predicate before signing a buy.
//
// Re-uses the existing spending_policy account for global daily/per-tx caps —
// this account only adds the *which celebs / which mode / which cap on this
// look* layer.

#[account]
pub struct WatchPolicy {
    pub owner: Pubkey,                  // 32
    pub celebs: Vec<String>,             // 4 + N * (4 + 32) — max 16 celebs
    pub section_filter: u8,              // 0=mens 1=womens 2=both 3=androgynous 4=any
    pub register_filter: u8,             // 0=masc 1=neutral 2=feminine 3=any
    pub mode: u8,                        // 0=notify 1=auto-buy-under-cap 2=auto-buy-full
    pub max_per_look_usd: u64,           // hard ceiling per single look auto-buy
    pub event_scope: Option<String>,     // 1 + (4 + 32) — null = applies all events
    pub created_at: i64,                 // 8
    pub updated_at: i64,                 // 8
    pub bump: u8,                        // 1
}

impl WatchPolicy {
    pub const MAX_CELEBS: usize = 16;
    pub const MAX_CELEB_LEN: usize = 32;
    pub const MAX_EVENT_SCOPE_LEN: usize = 32;
    // 8 disc + 32 owner + 4 vec_hdr + 16 * (4 + 32) celebs
    //   + 1 + 1 + 1 (filter bytes) + 8 cap
    //   + 1 + 4 + 32 (option<string> event_scope, max-sized)
    //   + 8 + 8 (timestamps) + 1 bump
    pub const SIZE: usize = 8
        + 32
        + 4 + Self::MAX_CELEBS * (4 + Self::MAX_CELEB_LEN)
        + 1 + 1 + 1
        + 8
        + 1 + 4 + Self::MAX_EVENT_SCOPE_LEN
        + 8 + 8 + 1;
}

#[derive(Accounts)]
pub struct SetWatchPolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = WatchPolicy::SIZE,
        seeds = [b"watch", owner.key().as_ref()],
        bump,
    )]
    pub watch: Account<'info, WatchPolicy>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClearWatchPolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        close = owner,
        seeds = [b"watch", owner.key().as_ref()],
        bump = watch.bump,
    )]
    pub watch: Account<'info, WatchPolicy>,
}

#[event]
pub struct WatchPolicySet {
    pub owner: Pubkey,
    pub celeb_count: u8,
    pub mode: u8,
    pub max_per_look_usd: u64,
}

#[event]
pub struct WatchPolicyCleared {
    pub owner: Pubkey,
}
