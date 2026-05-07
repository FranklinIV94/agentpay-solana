use anchor_lang::prelude::*;

declare_id!("D5yYFh3JDSKoKNGv6s4EDga4Ste7JPbyAS4GKuGuiQG7");

#[program]
pub mod agentpay {
    use super::*;

    /// Initialize a new agent wallet with spending limits
    pub fn create_agent_wallet(
        ctx: Context<CreateAgentWallet>,
        agent_name: String,
        daily_limit: u64,
        per_tx_limit: u64,
    ) -> Result<()> {
        let agent_wallet = &mut ctx.accounts.agent_wallet;
        agent_wallet.owner = ctx.accounts.owner.key();
        agent_wallet.agent_name = agent_name;
        agent_wallet.daily_limit = daily_limit;
        agent_wallet.per_tx_limit = per_tx_limit;
        agent_wallet.daily_spent = 0;
        agent_wallet.last_reset = Clock::get()?.unix_timestamp;
        agent_wallet.is_active = true;
        agent_wallet.skr_staked = 0;
        agent_wallet.total_approved = 0;
        agent_wallet.total_rejected = 0;
        agent_wallet.bump = ctx.bumps.agent_wallet;
        Ok(())
    }

    /// Agent submits a payment request (goes to pending approval queue)
    pub fn request_payment(
        ctx: Context<RequestPayment>,
        amount: u64,
        recipient: Pubkey,
        reason: String,
    ) -> Result<()> {
        let agent_wallet = &mut ctx.accounts.agent_wallet;

        // Check agent is active
        require!(agent_wallet.is_active, AgentPayError::AgentInactive);

        // Reset daily spent if new day
        let clock = Clock::get()?;
        let seconds_in_day = 86400;
        if clock.unix_timestamp - agent_wallet.last_reset >= seconds_in_day {
            agent_wallet.daily_spent = 0;
            agent_wallet.last_reset = clock.unix_timestamp;
        }

        // Check spending limits
        require!(
            amount <= agent_wallet.per_tx_limit,
            AgentPayError::ExceedsPerTxLimit
        );
        require!(
            agent_wallet.daily_spent + amount <= agent_wallet.daily_limit,
            AgentPayError::ExceedsDailyLimit
        );

        // Create pending payment request
        let payment_request = &mut ctx.accounts.payment_request;
        payment_request.agent_wallet = agent_wallet.key();
        payment_request.amount = amount;
        payment_request.recipient = recipient;
        payment_request.reason = reason;
        payment_request.status = PaymentStatus::Pending;
        payment_request.created_at = clock.unix_timestamp;
        payment_request.bump = ctx.bumps.payment_request;

        Ok(())
    }

    /// Owner approves a pending payment from their Seeker phone
    pub fn approve_payment(ctx: Context<ApprovePayment>) -> Result<()> {
        let payment_request = &mut ctx.accounts.payment_request;
        let agent_wallet = &mut ctx.accounts.agent_wallet;

        // Verify payment is still pending
        require!(
            payment_request.status == PaymentStatus::Pending,
            AgentPayError::PaymentNotPending
        );

        // Verify signer is the agent wallet owner
        require!(
            agent_wallet.owner == ctx.accounts.owner.key(),
            AgentPayError::NotOwner
        );

        // Transfer SOL from owner to recipient
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &payment_request.recipient,
            payment_request.amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
            ],
        )?;

        // Update state
        payment_request.status = PaymentStatus::Approved;
        agent_wallet.daily_spent += payment_request.amount;
        agent_wallet.total_approved += 1;

        Ok(())
    }

    /// Owner rejects a pending payment
    pub fn reject_payment(ctx: Context<RejectPayment>) -> Result<()> {
        let payment_request = &mut ctx.accounts.payment_request;
        let agent_wallet = &mut ctx.accounts.agent_wallet;

        require!(
            payment_request.status == PaymentStatus::Pending,
            AgentPayError::PaymentNotPending
        );
        require!(
            agent_wallet.owner == ctx.accounts.owner.key(),
            AgentPayError::NotOwner
        );

        payment_request.status = PaymentStatus::Rejected;
        agent_wallet.total_rejected += 1;

        Ok(())
    }

    /// Reserve credit for variable-cost operations (e.g., LLM inference)
    pub fn reserve_credit(
        ctx: Context<ReserveCredit>,
        max_amount: u64,
        reason: String,
    ) -> Result<()> {
        let agent_wallet = &mut ctx.accounts.agent_wallet;
        let reservation = &mut ctx.accounts.reservation;

        require!(agent_wallet.is_active, AgentPayError::AgentInactive);
        require!(
            max_amount <= agent_wallet.per_tx_limit,
            AgentPayError::ExceedsPerTxLimit
        );

        reservation.agent_wallet = agent_wallet.key();
        reservation.max_amount = max_amount;
        reservation.captured_amount = 0;
        reservation.reason = reason;
        reservation.status = ReservationStatus::Active;
        reservation.created_at = Clock::get()?.unix_timestamp;
        reservation.bump = ctx.bumps.reservation;

        Ok(())
    }

    /// Capture actual amount after variable-cost operation completes
    pub fn capture_payment(ctx: Context<CapturePayment>, actual_amount: u64) -> Result<()> {
        let reservation = &mut ctx.accounts.reservation;
        let agent_wallet = &mut ctx.accounts.agent_wallet;

        require!(
            reservation.status == ReservationStatus::Active,
            AgentPayError::ReservationNotActive
        );
        require!(
            actual_amount <= reservation.max_amount,
            AgentPayError::ExceedsReservation
        );

        // Transfer actual amount
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.recipient.key(),
            actual_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
            ],
        )?;

        reservation.captured_amount = actual_amount;
        reservation.status = ReservationStatus::Captured;
        agent_wallet.daily_spent += actual_amount;
        agent_wallet.total_approved += 1;

        Ok(())
    }

    /// Update spending limits for an agent
    pub fn update_spending_limit(
        ctx: Context<UpdateSpendingLimit>,
        daily_limit: u64,
        per_tx_limit: u64,
    ) -> Result<()> {
        let agent_wallet = &mut ctx.accounts.agent_wallet;
        require!(
            agent_wallet.owner == ctx.accounts.owner.key(),
            AgentPayError::NotOwner
        );

        // SKR stakers get 2x limit multiplier
        let multiplier = if agent_wallet.skr_staked > 0 { 2 } else { 1 };
        agent_wallet.daily_limit = daily_limit * multiplier;
        agent_wallet.per_tx_limit = per_tx_limit * multiplier;

        Ok(())
    }

    /// Stake SKR tokens for premium features (2x limits, analytics)
    pub fn stake_skr(ctx: Context<StakeSkr>, amount: u64) -> Result<()> {
        let agent_wallet = &mut ctx.accounts.agent_wallet;
        require!(
            agent_wallet.owner == ctx.accounts.owner.key(),
            AgentPayError::NotOwner
        );

        agent_wallet.skr_staked += amount;

        // Apply 2x multiplier when SKR is staked
        agent_wallet.daily_limit *= 2;
        agent_wallet.per_tx_limit *= 2;

        Ok(())
    }
}

// ─── Accounts ───────────────────────────────────────────────────────

#[account]
pub struct AgentWallet {
    pub owner: Pubkey,
    pub agent_name: String,
    pub daily_limit: u64,
    pub per_tx_limit: u64,
    pub daily_spent: u64,
    pub last_reset: i64,
    pub is_active: bool,
    pub skr_staked: u64,
    pub total_approved: u64,
    pub total_rejected: u64,
    pub bump: u8,
}

#[account]
pub struct PaymentRequest {
    pub agent_wallet: Pubkey,
    pub amount: u64,
    pub recipient: Pubkey,
    pub reason: String,
    pub status: PaymentStatus,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct CreditReservation {
    pub agent_wallet: Pubkey,
    pub max_amount: u64,
    pub captured_amount: u64,
    pub reason: String,
    pub status: ReservationStatus,
    pub created_at: i64,
    pub bump: u8,
}

// ─── Enums ──────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PaymentStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ReservationStatus {
    Active,
    Captured,
    Released,
    Expired,
}

// ─── Contexts ───────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(agent_name: String)]
pub struct CreateAgentWallet<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = AgentWallet::INIT_SPACE,
        seeds = [b"agent_wallet", owner.key().as_ref(), agent_name.as_bytes()],
        bump
    )]
    pub agent_wallet: Account<'info, AgentWallet>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestPayment<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(mut)]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        init,
        payer = agent,
        space = PaymentRequest::INIT_SPACE,
        seeds = [b"payment_request", agent_wallet.key().as_ref()],
        bump
    )]
    pub payment_request: Account<'info, PaymentRequest>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApprovePayment<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(mut)]
    pub payment_request: Account<'info, PaymentRequest>,

    /// CHECK: Recipient validated by payment_request.recipient
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RejectPayment<'info> {
    pub owner: Signer<'info>,

    #[account(mut)]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(mut)]
    pub payment_request: Account<'info, PaymentRequest>,
}

#[derive(Accounts)]
pub struct ReserveCredit<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,

    #[account(mut)]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(
        init,
        payer = agent,
        space = CreditReservation::INIT_SPACE,
        seeds = [b"reservation", agent_wallet.key().as_ref()],
        bump
    )]
    pub reservation: Account<'info, CreditReservation>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CapturePayment<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub agent_wallet: Account<'info, AgentWallet>,

    #[account(mut)]
    pub reservation: Account<'info, CreditReservation>,

    /// CHECK: Recipient for captured payment
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateSpendingLimit<'info> {
    pub owner: Signer<'info>,

    #[account(mut)]
    pub agent_wallet: Account<'info, AgentWallet>,
}

#[derive(Accounts)]
pub struct StakeSkr<'info> {
    pub owner: Signer<'info>,

    #[account(mut)]
    pub agent_wallet: Account<'info, AgentWallet>,
}

// ─── Space calculations ─────────────────────────────────────────────

impl AgentWallet {
    pub const INIT_SPACE: usize = 8 + 32 + (4 + 64) + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 8 + 1;
}

impl PaymentRequest {
    pub const INIT_SPACE: usize = 8 + 32 + 8 + 32 + (4 + 256) + 1 + 8 + 1;
}

impl CreditReservation {
    pub const INIT_SPACE: usize = 8 + 32 + 8 + 8 + (4 + 256) + 1 + 8 + 1;
}

// ─── Errors ─────────────────────────────────────────────────────────

#[error_code]
pub enum AgentPayError {
    #[msg("Agent wallet is inactive")]
    AgentInactive,
    #[msg("Payment amount exceeds per-transaction limit")]
    ExceedsPerTxLimit,
    #[msg("Payment would exceed daily spending limit")]
    ExceedsDailyLimit,
    #[msg("Payment is not in pending status")]
    PaymentNotPending,
    #[msg("Only the wallet owner can perform this action")]
    NotOwner,
    #[msg("Reservation is not active")]
    ReservationNotActive,
    #[msg("Captured amount exceeds reservation max")]
    ExceedsReservation,
}