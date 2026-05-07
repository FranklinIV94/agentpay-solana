import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Agentpay } from "../target/types/agentpay";
import { assert } from "chai";

describe("AgentPay Solana", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Agentpay as Program<Agentpay>;
  const owner = provider.wallet;
  let agentWalletPda: anchor.web3.PublicKey;
  let agentWalletBump: number;

  before(async () => {
    const [pda, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("agent_wallet"), owner.publicKey.toBuffer(), Buffer.from("test-agent")],
      program.programId
    );
    agentWalletPda = pda;
    agentWalletBump = bump;
  });

  it("Creates an agent wallet with spending limits", async () => {
    const dailyLimit = new anchor.BN(1_000_000_000); // 1 SOL
    const perTxLimit = new anchor.BN(100_000_000);   // 0.1 SOL

    await program.methods
      .createAgentWallet("test-agent", dailyLimit, perTxLimit)
      .accounts({
        owner: owner.publicKey,
        agentWallet: agentWalletPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const wallet = await program.account.agentWallet.fetch(agentWalletPda);
    assert.equal(wallet.agentName, "test-agent");
    assert.equal(wallet.dailyLimit.toString(), dailyLimit.toString());
    assert.equal(wallet.perTxLimit.toString(), perTxLimit.toString());
    assert.equal(wallet.isActive, true);
    assert.equal(wallet.skrStaked.toString(), "0");
  });

  it("Rejects payments exceeding per-transaction limit", async () => {
    // This should fail — 2 SOL exceeds the 0.1 SOL per-tx limit
    try {
      const [paymentPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("payment_request"), agentWalletPda.toBuffer()],
        program.programId
      );

      await program.methods
        .requestPayment(
          new anchor.BN(200_000_000), // 0.2 SOL — over limit
          owner.publicKey,
          "test over limit"
        )
        .accounts({
          agent: owner.publicKey,
          agentWallet: agentWalletPda,
          paymentRequest: paymentPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "ExceedsPerTxLimit");
    }
  });

  it("Updates spending limits", async () => {
    const newDailyLimit = new anchor.BN(5_000_000_000); // 5 SOL
    const newPerTxLimit = new anchor.BN(500_000_000);   // 0.5 SOL

    await program.methods
      .updateSpendingLimit(newDailyLimit, newPerTxLimit)
      .accounts({
        owner: owner.publicKey,
        agentWallet: agentWalletPda,
      })
      .rpc();

    const wallet = await program.account.agentWallet.fetch(agentWalletPda);
    assert.equal(wallet.dailyLimit.toString(), newDailyLimit.toString());
    assert.equal(wallet.perTxLimit.toString(), newPerTxLimit.toString());
  });
});