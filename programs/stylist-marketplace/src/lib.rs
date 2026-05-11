use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("G5FE1NnanqQJGNCyqLnKqKonYFWVzyzoAeZ9rUtf8F5e");

const SECS_PER_PERIOD: i64 = 30 * 24 * 60 * 60;
const PLATFORM_FEE_BPS: u64 = 1000; // 10%

#[program]
pub mod stylist_marketplace {
    use super::*;

    pub fn create_profile(
        ctx: Context<CreateProfile>,
        handle: String,
        bio: String,
        fee_per_month: u64,
    ) -> Result<()> {
        require!(handle.len() <= 32, MarketError::InvalidInput);
        require!(bio.len() <= 280, MarketError::InvalidInput);
        require!(fee_per_month > 0, MarketError::InvalidInput);

        let profile = &mut ctx.accounts.profile;
        profile.stylist = ctx.accounts.stylist.key();
        profile.handle = handle;
        profile.bio = bio;
        profile.fee_per_month = fee_per_month;
        profile.payout_token_account = ctx.accounts.payout_token_account.key();
        profile.subscriber_count = 0;
        profile.bump = ctx.bumps.profile;
        Ok(())
    }

    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        bio: String,
        fee_per_month: u64,
    ) -> Result<()> {
        require!(bio.len() <= 280, MarketError::InvalidInput);
        require!(fee_per_month > 0, MarketError::InvalidInput);
        let profile = &mut ctx.accounts.profile;
        require_keys_eq!(
            profile.stylist,
            ctx.accounts.stylist.key(),
            MarketError::Unauthorized
        );
        profile.bio = bio;
        profile.fee_per_month = fee_per_month;
        Ok(())
    }

    /// Subscribe a user to a stylist for one period (30 days). Pulls fee_per_month USDC
    /// from subscriber's token account, splits 90% to stylist, 10% to platform treasury.
    pub fn subscribe(ctx: Context<Subscribe>) -> Result<()> {
        let profile = &mut ctx.accounts.profile;
        let amount = profile.fee_per_month;
        let platform_cut = amount
            .checked_mul(PLATFORM_FEE_BPS)
            .ok_or(MarketError::Overflow)?
            / 10_000;
        let stylist_cut = amount
            .checked_sub(platform_cut)
            .ok_or(MarketError::Overflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.subscriber_token_account.to_account_info(),
                    to: ctx.accounts.stylist_token_account.to_account_info(),
                    authority: ctx.accounts.subscriber.to_account_info(),
                },
            ),
            stylist_cut,
        )?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.subscriber_token_account.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.subscriber.to_account_info(),
                },
            ),
            platform_cut,
        )?;

        let now = Clock::get()?.unix_timestamp;
        let sub = &mut ctx.accounts.subscription;
        sub.subscriber = ctx.accounts.subscriber.key();
        sub.stylist = profile.stylist;
        sub.started_at = now;
        sub.expires_at = now + SECS_PER_PERIOD;
        sub.bump = ctx.bumps.subscription;

        profile.subscriber_count = profile.subscriber_count.saturating_add(1);

        emit!(Subscribed {
            subscriber: sub.subscriber,
            stylist: sub.stylist,
            amount,
            expires_at: sub.expires_at,
        });
        Ok(())
    }
}

#[account]
pub struct StylistProfile {
    pub stylist: Pubkey,
    pub handle: String,
    pub bio: String,
    pub fee_per_month: u64,
    pub payout_token_account: Pubkey,
    pub subscriber_count: u32,
    pub bump: u8,
}

impl StylistProfile {
    pub const SIZE: usize = 8 + 32 + (4 + 32) + (4 + 280) + 8 + 32 + 4 + 1;
}

#[account]
pub struct Subscription {
    pub subscriber: Pubkey,
    pub stylist: Pubkey,
    pub started_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}

impl Subscription {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[derive(Accounts)]
#[instruction(handle: String)]
pub struct CreateProfile<'info> {
    #[account(mut)]
    pub stylist: Signer<'info>,

    #[account(
        init,
        payer = stylist,
        space = StylistProfile::SIZE,
        seeds = [b"profile", stylist.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, StylistProfile>,

    pub payout_token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    pub stylist: Signer<'info>,

    #[account(
        mut,
        seeds = [b"profile", stylist.key().as_ref()],
        bump = profile.bump,
    )]
    pub profile: Account<'info, StylistProfile>,
}

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,

    /// CHECK: stylist key only used for PDA derivation
    pub stylist_key: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"profile", stylist_key.key().as_ref()],
        bump = profile.bump,
    )]
    pub profile: Account<'info, StylistProfile>,

    #[account(
        init,
        payer = subscriber,
        space = Subscription::SIZE,
        seeds = [b"sub", subscriber.key().as_ref(), stylist_key.key().as_ref()],
        bump,
    )]
    pub subscription: Account<'info, Subscription>,

    #[account(mut)]
    pub subscriber_token_account: Account<'info, TokenAccount>,

    #[account(mut, address = profile.payout_token_account)]
    pub stylist_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct Subscribed {
    pub subscriber: Pubkey,
    pub stylist: Pubkey,
    pub amount: u64,
    pub expires_at: i64,
}

#[error_code]
pub enum MarketError {
    #[msg("Caller is not the profile owner")]
    Unauthorized,
    #[msg("Invalid input")]
    InvalidInput,
    #[msg("Arithmetic overflow")]
    Overflow,
}
