import type { Language } from '../contexts/EditorContext';
import { ALICE, BOB, CHARLIE } from './test-keys';

/** A typed argument for a contract method call */
export type MethodArg =
  | { type: 'ByteString'; value: string }       // hex-encoded bytes
  | { type: 'PubKey'; value: string }            // 33-byte compressed pubkey hex
  | { type: 'Sig'; signer: string }              // sign with named test key (alice, bob, etc.)
  | { type: 'bigint'; value: string }            // numeric string
  | { type: 'boolean'; value: boolean };

export interface MethodCall {
  method: string;
  args: MethodArg[];
}

export interface Example {
  id: string;
  name: string;
  language: Language;
  source: string;
  constructorArgs: Record<string, bigint | boolean | string>;
  /** Method to call with typed args — real signatures generated at execution time */
  methodCall: MethodCall;
  /** Human-readable description of what the example demonstrates */
  description: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'hello-world',
    name: 'Hello World',
    language: 'typescript',
    source: `/**
 * HelloWorld — the simplest possible Rúnar contract.
 *
 * Locks funds with a greeting (a ByteString). To unlock, provide the same
 * bytes as the message. Demonstrates basic constructor args, property access,
 * and assertion-based verification.
 */
class HelloWorld extends SmartContract {
  readonly greeting: ByteString

  constructor(greeting: ByteString) {
    super(greeting)
    this.greeting = greeting
  }

  public unlock(message: ByteString) {
    assert(message === this.greeting)
  }
}
`,
    constructorArgs: {
      greeting: '68656c6c6f', // "hello"
    },
    methodCall: {
      method: 'unlock',
      args: [{ type: 'ByteString', value: '68656c6c6f' }], // push "hello" as message
    },
    description: 'Simplest contract: locks funds with a greeting, unlocks by providing the same bytes.',
  },
  {
    id: 'hash-puzzle',
    name: 'Hash Puzzle',
    language: 'typescript',
    source: `/**
 * HashPuzzle — lock funds behind a SHA-256 hash.
 *
 * The deployer provides a hash; anyone who knows the preimage can unlock
 * the funds. Demonstrates cryptographic hash verification in Bitcoin Script.
 */
class HashPuzzle extends SmartContract {
  readonly hash: Sha256

  constructor(hash: Sha256) {
    super(hash)
    this.hash = hash
  }

  public unlock(preimage: ByteString) {
    assert(sha256(preimage) === this.hash)
  }
}
`,
    constructorArgs: {
      // sha256("secret") = 2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b
      hash: '2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b',
    },
    methodCall: {
      method: 'unlock',
      args: [{ type: 'ByteString', value: '736563726574' }], // "secret"
    },
    description: 'Hash puzzle: locks with sha256 hash, unlocks by providing the preimage.',
  },
  {
    id: 'boolean-logic',
    name: 'Boolean Logic',
    language: 'typescript',
    source: `/**
 * BooleanLogic — arithmetic constraint contract.
 *
 * Unlocks when two positive numbers a and b sum to at least the threshold.
 * Demonstrates bigint arithmetic and multiple assertions in Bitcoin Script.
 */
class BooleanLogic extends SmartContract {
  readonly threshold: bigint

  constructor(threshold: bigint) {
    super(threshold)
    this.threshold = threshold
  }

  public unlock(a: bigint, b: bigint) {
    assert(a + b >= this.threshold)
    assert(a > 0n)
    assert(b > 0n)
  }
}
`,
    constructorArgs: {
      threshold: 10n,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'bigint', value: '7' },
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Arithmetic contract: unlocks when a + b >= threshold and both are positive.',
  },
  {
    id: 'p2pkh',
    name: 'P2PKH (Alice)',
    language: 'typescript',
    source: `/**
 * P2PKH — Pay-to-Public-Key-Hash, the most common Bitcoin transaction type.
 *
 * Locks funds to a public key hash. To unlock, provide a signature and the
 * public key whose hash160 matches. Demonstrates checkSig and hash160.
 */
class P2PKH extends SmartContract {
  readonly pubKeyHash: Ripemd160

  constructor(pubKeyHash: Ripemd160) {
    super(pubKeyHash)
    this.pubKeyHash = pubKeyHash
  }

  public unlock(sig: Sig, pubKey: PubKey) {
    assert(hash160(pubKey) === this.pubKeyHash)
    assert(checkSig(sig, pubKey))
  }
}
`,
    constructorArgs: {
      pubKeyHash: ALICE.pubKeyHash,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: `Pay-to-Public-Key-Hash locked to Alice's key. Unlocks with Alice's real signature.`,
  },
  {
    id: 'escrow',
    name: 'Escrow (Alice/Bob/Charlie)',
    language: 'typescript',
    source: `/**
 * Escrow — three-party escrow with multiple spending paths.
 *
 * Buyer, seller, and arbiter each have a public key. Funds can be released
 * (buyer+seller), refunded (buyer+arbiter), or arbitrated (seller+arbiter).
 * Demonstrates multi-method contracts with 2-of-3 signature patterns.
 */
class Escrow extends SmartContract {
  readonly buyerPubKey: PubKey
  readonly sellerPubKey: PubKey
  readonly arbiterPubKey: PubKey

  constructor(buyerPubKey: PubKey, sellerPubKey: PubKey, arbiterPubKey: PubKey) {
    super(buyerPubKey, sellerPubKey, arbiterPubKey)
    this.buyerPubKey = buyerPubKey
    this.sellerPubKey = sellerPubKey
    this.arbiterPubKey = arbiterPubKey
  }

  public release(buyerSig: Sig, sellerSig: Sig) {
    assert(checkSig(buyerSig, this.buyerPubKey))
    assert(checkSig(sellerSig, this.sellerPubKey))
  }

  public refund(buyerSig: Sig, arbiterSig: Sig) {
    assert(checkSig(buyerSig, this.buyerPubKey))
    assert(checkSig(arbiterSig, this.arbiterPubKey))
  }

  public arbitrate(sellerSig: Sig, arbiterSig: Sig) {
    assert(checkSig(sellerSig, this.sellerPubKey))
    assert(checkSig(arbiterSig, this.arbiterPubKey))
  }
}
`,
    constructorArgs: {
      buyerPubKey: ALICE.pubKey,
      sellerPubKey: BOB.pubKey,
      arbiterPubKey: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'release',
      args: [
        { type: 'Sig', signer: 'alice' },   // buyerSig
        { type: 'Sig', signer: 'bob' },      // sellerSig
      ],
    },
    description: 'Escrow: buyer=Alice, seller=Bob, arbiter=Charlie. Calls "release" with real signatures from Alice and Bob.',
  },
  {
    id: 'time-lock',
    name: 'Time Lock (Alice)',
    language: 'typescript',
    source: `/**
 * TimeLock — signature + amount threshold contract.
 *
 * Requires the owner's signature AND an amount that meets or exceeds the
 * threshold. Demonstrates combining checkSig with arithmetic assertions.
 */
class TimeLock extends SmartContract {
  readonly ownerPubKey: PubKey
  readonly threshold: bigint

  constructor(ownerPubKey: PubKey, threshold: bigint) {
    super(ownerPubKey, threshold)
    this.ownerPubKey = ownerPubKey
    this.threshold = threshold
  }

  public unlock(sig: Sig, amount: bigint) {
    assert(checkSig(sig, this.ownerPubKey))
    assert(amount >= this.threshold)
  }
}
`,
    constructorArgs: {
      ownerPubKey: ALICE.pubKey,
      threshold: 1000n,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'bigint', value: '1500' },
      ],
    },
    description: 'Signature + amount threshold: requires Alice\'s signature and an amount >= 1000.',
  },
  {
    id: 'multi-sig',
    name: 'Multi-Sig 2-of-3',
    language: 'typescript',
    source: `/**
 * MultiSig — 2-of-3 multi-signature contract.
 *
 * Requires any 2 of 3 designated signers to authorize spending.
 * Demonstrates checkMultiSig with array literal syntax.
 */
class MultiSig extends SmartContract {
  readonly pubKey1: PubKey
  readonly pubKey2: PubKey
  readonly pubKey3: PubKey

  constructor(pubKey1: PubKey, pubKey2: PubKey, pubKey3: PubKey) {
    super(pubKey1, pubKey2, pubKey3)
    this.pubKey1 = pubKey1
    this.pubKey2 = pubKey2
    this.pubKey3 = pubKey3
  }

  public unlock(sig1: Sig, sig2: Sig) {
    assert(checkMultiSig([sig1, sig2], [this.pubKey1, this.pubKey2, this.pubKey3]))
  }
}
`,
    constructorArgs: {
      pubKey1: ALICE.pubKey,
      pubKey2: BOB.pubKey,
      pubKey3: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: '2-of-3 multi-sig with Alice, Bob, Charlie. Unlocks with real signatures from Alice and Bob.',
  },
  {
    id: 'counter',
    name: 'Counter (Stateful)',
    language: 'typescript',
    source: `/**
 * Counter — the simplest possible stateful smart contract.
 *
 * Demonstrates Rúnar's state management: a counter that persists its value
 * across spending transactions on the Bitcoin SV blockchain.
 *
 * Because this class extends StatefulSmartContract, the compiler automatically
 * injects checkPreimage at each public method entry and state continuation at
 * each public method exit.
 *
 * Script layout (on-chain):
 *   Locking: <contract logic> OP_RETURN <count>
 */
class Counter extends StatefulSmartContract {
  count: bigint

  constructor(count: bigint) {
    super(count)
    this.count = count
  }

  public increment() {
    this.count++
  }

  public decrement() {
    assert(this.count > 0n)
    this.count--
  }
}
`,
    constructorArgs: {
      count: 0n,
    },
    methodCall: {
      method: 'increment',
      args: [],
    },
    description: 'Simplest stateful contract: a counter that persists across transactions. Anyone can increment or decrement.',
  },
  {
    id: 'auction',
    name: 'Auction (Stateful)',
    language: 'typescript',
    source: `/**
 * On-chain English auction contract.
 *
 * Bidders compete by submitting progressively higher bids until a block-height
 * deadline. After the deadline, only the auctioneer can close the auction.
 *
 * Stateful: extends StatefulSmartContract. The compiler auto-injects
 * checkPreimage at method entry and state continuation at method exit.
 *
 * Time enforcement: Uses Bitcoin's native nLockTime via extractLocktime().
 */
class Auction extends StatefulSmartContract {
  readonly auctioneer: PubKey
  highestBidder: PubKey
  highestBid: bigint
  readonly deadline: bigint

  constructor(auctioneer: PubKey, highestBidder: PubKey, highestBid: bigint, deadline: bigint) {
    super(auctioneer, highestBidder, highestBid, deadline)
    this.auctioneer = auctioneer
    this.highestBidder = highestBidder
    this.highestBid = highestBid
    this.deadline = deadline
  }

  public bid(sig: Sig, bidder: PubKey, bidAmount: bigint) {
    assert(checkSig(sig, bidder))
    assert(bidAmount > this.highestBid)
    assert(extractLocktime(this.txPreimage) < this.deadline)
    this.highestBidder = bidder
    this.highestBid = bidAmount
  }

  public close(sig: Sig) {
    assert(checkSig(sig, this.auctioneer))
    assert(extractLocktime(this.txPreimage) >= this.deadline)
  }
}
`,
    constructorArgs: {
      auctioneer: ALICE.pubKey,
      highestBidder: BOB.pubKey,
      highestBid: 0n,
      deadline: 500000n,
    },
    methodCall: {
      method: 'close',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'On-chain English auction with block-height deadline. Set locktime >= 500000 to close, < 500000 to bid.',
  },
  {
    id: 'nft',
    name: 'Simple NFT (Stateful)',
    language: 'typescript',
    source: `/**
 * SimpleNFT — A non-fungible token represented as a single UTXO.
 *
 * Each NFT is a single UTXO carrying:
 *   - owner (mutable): current owner's public key, updated on transfer
 *   - tokenId (readonly): unique identifier baked into the locking script
 *   - metadata (readonly): content hash or URI, immutable
 *
 * Operations:
 *   - transfer: changes ownership, creates continuation UTXO via addOutput
 *   - burn: destroys the token permanently (no addOutput = no successor)
 *
 * The burn pattern: when a stateful method doesn't call addOutput, the compiler
 * generates no state continuation — the UTXO is spent with no successor.
 */
class SimpleNFT extends StatefulSmartContract {
  owner: PubKey
  readonly tokenId: ByteString
  readonly metadata: ByteString

  constructor(owner: PubKey, tokenId: ByteString, metadata: ByteString) {
    super(owner, tokenId, metadata)
    this.owner = owner
    this.tokenId = tokenId
    this.metadata = metadata
  }

  public transfer(sig: Sig, newOwner: PubKey, outputSatoshis: bigint) {
    assert(checkSig(sig, this.owner))
    assert(outputSatoshis >= 1n)
    this.addOutput(outputSatoshis, newOwner)
  }

  public burn(sig: Sig) {
    assert(checkSig(sig, this.owner))
  }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      tokenId: 'deadbeef01',
      metadata: 'cafe0123456789',
    },
    methodCall: {
      method: 'burn',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Non-fungible token as a UTXO. Transfer changes ownership; burn destroys the token permanently.',
  },
  {
    id: 'bounded-counter',
    name: 'Bounded Counter (Stateful)',
    language: 'typescript',
    source: `/**
 * BoundedCounter — demonstrates property initializers.
 *
 * Properties with \`= value\` defaults are excluded from the constructor,
 * simplifying deployment. Only maxCount needs to be provided at deploy time;
 * count starts at 0 and active starts as true automatically.
 */
class BoundedCounter extends StatefulSmartContract {
  count: bigint = 0n
  readonly maxCount: bigint
  readonly active: boolean = true

  constructor(maxCount: bigint) {
    super(maxCount)
    this.maxCount = maxCount
  }

  public increment(amount: bigint) {
    assert(this.active)
    this.count = this.count + amount
    assert(this.count <= this.maxCount)
  }

  public reset() {
    this.count = 0n
  }
}
`,
    constructorArgs: {
      maxCount: 100n,
    },
    methodCall: {
      method: 'increment',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Counter with a maximum bound and property initializers. count starts at 0, active starts as true.',
  },
  {
    id: 'oracle-price',
    name: 'Oracle Price Feed',
    language: 'typescript',
    source: `/**
 * OraclePriceFeed — Oracle contract for price-triggered payouts.
 *
 * Demonstrates the "oracle pattern": off-chain data (asset prices) is
 * cryptographically signed by a trusted oracle and verified on-chain
 * using Rabin signatures.
 *
 * Three verification layers:
 *   1. Oracle verification — price signed by trusted Rabin key
 *   2. Price threshold — price must exceed 50,000
 *   3. Receiver authorization — ECDSA signature to claim payout
 */
class OraclePriceFeed extends SmartContract {
  readonly oraclePubKey: RabinPubKey
  readonly receiver: PubKey

  constructor(oraclePubKey: RabinPubKey, receiver: PubKey) {
    super(oraclePubKey, receiver)
    this.oraclePubKey = oraclePubKey
    this.receiver = receiver
  }

  public settle(price: bigint, rabinSig: RabinSig, padding: ByteString, sig: Sig) {
    const msg = num2bin(price, 8n)
    assert(verifyRabinSig(msg, rabinSig, padding, this.oraclePubKey))
    assert(price > 50000n)
    assert(checkSig(sig, this.receiver))
  }
}
`,
    constructorArgs: {
      // Rabin test key: n = p * q where p, q are 130-bit primes ≡ 3 (mod 4)
      oraclePubKey: 1852673427797059126777135760139020137744618460251467317973768694675137031965589n,
      receiver: ALICE.pubKey,
    },
    methodCall: {
      method: 'settle',
      args: [
        { type: 'bigint', value: '60000' },
        // Pre-computed valid Rabin signature of num2bin(60000, 8) using the test key
        { type: 'bigint', value: '195594275932023152769541819028047709452880413796780214800172974889079016519477' },
        { type: 'ByteString', value: '04' },
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Oracle-verified price feed with real Rabin signature. Price 60000 is signed by the test oracle key and exceeds the 50,000 threshold.',
  },
  {
    id: 'zig-p2pkh',
    name: 'P2PKH (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

/// P2PKH — Pay-to-Public-Key-Hash in Zig.
///
/// Locks funds to a public key hash. To unlock, provide a signature and the
/// public key whose hash160 matches. Demonstrates checkSig and hash160.
pub const P2PKH = struct {
    pub const Contract = runar.SmartContract;

    pubKeyHash: runar.Addr,

    pub fn init(pubKeyHash: runar.Addr) P2PKH {
        return .{ .pubKeyHash = pubKeyHash };
    }

    pub fn unlock(self: *const P2PKH, sig: runar.Sig, pubKey: runar.PubKey) void {
        runar.assert(runar.hash160(pubKey) == self.pubKeyHash);
        runar.assert(runar.checkSig(sig, pubKey));
    }
};
`,
    constructorArgs: {
      pubKeyHash: ALICE.pubKeyHash,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Pay-to-Public-Key-Hash in Zig. Locked to Alice\'s key, unlocks with her real signature.',
  },
  {
    id: 'zig-counter',
    name: 'Counter (Zig, Stateful)',
    language: 'zig',
    source: `const runar = @import("runar");

/// Counter — the simplest stateful contract in Zig.
///
/// A counter that persists its value across spending transactions.
/// Extends StatefulSmartContract for automatic preimage checking and
/// state continuation.
pub const Counter = struct {
    pub const Contract = runar.StatefulSmartContract;

    count: i64 = 0,

    pub fn init(count: i64) Counter {
        return .{ .count = count };
    }

    pub fn increment(self: *Counter) void {
        self.count += 1;
    }

    pub fn decrement(self: *Counter) void {
        runar.assert(self.count > 0);
        self.count -= 1;
    }
};
`,
    constructorArgs: {
      count: 0n,
    },
    methodCall: {
      method: 'increment',
      args: [],
    },
    description: 'Simplest stateful contract in Zig: a counter that persists across transactions. Anyone can increment or decrement.',
  },
  {
    id: 'zig-escrow',
    name: 'Escrow (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

/// Escrow — three-party escrow with two spending paths, written in Zig.
///
/// Buyer, seller, and arbiter each have a public key. Funds can be released
/// (seller+arbiter) or refunded (buyer+arbiter). Demonstrates multi-method
/// contracts with 2-of-3 signature patterns.
pub const Escrow = struct {
    pub const Contract = runar.SmartContract;

    buyer: runar.PubKey,
    seller: runar.PubKey,
    arbiter: runar.PubKey,

    pub fn init(buyer: runar.PubKey, seller: runar.PubKey, arbiter: runar.PubKey) Escrow {
        return .{
            .buyer = buyer,
            .seller = seller,
            .arbiter = arbiter,
        };
    }

    pub fn release(self: *const Escrow, sellerSig: runar.Sig, arbiterSig: runar.Sig) void {
        runar.assert(runar.checkSig(sellerSig, self.seller));
        runar.assert(runar.checkSig(arbiterSig, self.arbiter));
    }

    pub fn refund(self: *const Escrow, buyerSig: runar.Sig, arbiterSig: runar.Sig) void {
        runar.assert(runar.checkSig(buyerSig, self.buyer));
        runar.assert(runar.checkSig(arbiterSig, self.arbiter));
    }
};
`,
    constructorArgs: {
      buyer: ALICE.pubKey,
      seller: BOB.pubKey,
      arbiter: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'release',
      args: [
        { type: 'Sig', signer: 'bob' },
        { type: 'Sig', signer: 'charlie' },
      ],
    },
    description: 'Escrow in Zig: buyer=Alice, seller=Bob, arbiter=Charlie. Calls "release" with seller and arbiter signatures.',
  },
  {
    id: 'sol-p2pkh',
    name: 'P2PKH (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title P2PKH — Pay-to-Public-Key-Hash
/// @notice The most fundamental Bitcoin spending pattern. Funds are locked to
/// the HASH160 (SHA-256 then RIPEMD-160) of a public key. To spend, the
/// recipient must provide their full public key (which must hash to the stored
/// hash) and a valid ECDSA signature over the transaction.
///
/// How It Works: Two-Step Verification
///
///  1. Hash check — hash160(pubKey) == pubKeyHash proves the provided public
///     key matches the one committed to when the output was created.
///  2. Signature check — checkSig(sig, pubKey) proves the spender holds the
///     private key corresponding to that public key.
///
/// This is the same pattern as standard Bitcoin P2PKH transactions, but
/// expressed in the Runar smart contract language.
///
/// Script Layout:
///   Unlocking: <sig> <pubKey>
///   Locking:   OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
///
/// Parameter Sizes:
///   - pubKeyHash: 20 bytes (HASH160 of compressed public key)
///   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
///   - pubKey: 33 bytes (compressed secp256k1 public key)
contract P2PKH is SmartContract {
    Addr immutable pubKeyHash;

    constructor(Addr _pubKeyHash) {
        pubKeyHash = _pubKeyHash;
    }

    /// @notice Verify the pubKey hashes to the committed hash, then check the signature.
    function unlock(Sig sig, PubKey pubKey) public {
        // Step 1: Verify pubKey matches the committed hash
        require(hash160(pubKey) == pubKeyHash);
        // Step 2: Verify ECDSA signature proves ownership of the private key
        require(checkSig(sig, pubKey));
    }
}
`,
    constructorArgs: {
      pubKeyHash: ALICE.pubKeyHash,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Pay-to-Public-Key-Hash: locks funds to a public key hash, unlocks with signature.',
  },
  {
    id: 'move-p2pkh',
    name: 'P2PKH (Move)',
    language: 'move',
    source: `// P2PKH — Pay-to-Public-Key-Hash.
//
// The most fundamental Bitcoin spending pattern. Funds are locked to the
// HASH160 (SHA-256 then RIPEMD-160) of a public key. To spend, the recipient
// must provide their full public key (which must hash to the stored hash)
// and a valid ECDSA signature over the transaction.
//
// How It Works: Two-Step Verification
//
//  1. Hash check — hash160(pub_key) == pub_key_hash proves the provided
//     public key matches the one committed to when the output was created.
//  2. Signature check — check_sig(sig, pub_key) proves the spender
//     holds the private key corresponding to that public key.
//
// This is the same pattern as standard Bitcoin P2PKH transactions, but
// expressed in the Runar smart contract language.
//
// Script Layout:
//   Unlocking: <sig> <pubKey>
//   Locking:   OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
//
// Parameter Sizes:
//   - pub_key_hash: 20 bytes (HASH160 of compressed public key)
//   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
//   - pub_key: 33 bytes (compressed secp256k1 public key)
module P2PKH {
    use runar::types::{Addr, PubKey, Sig};
    use runar::crypto::{hash160, check_sig};

    resource struct P2PKH {
        pub_key_hash: Addr,
    }

    // Verify the pub_key hashes to the committed hash, then check the signature.
    public fun unlock(contract: &P2PKH, sig: Sig, pub_key: PubKey) {
        // Step 1: Verify pub_key matches the committed hash
        assert!(hash160(pub_key) == contract.pub_key_hash, 0);
        // Step 2: Verify ECDSA signature proves ownership of the private key
        assert!(check_sig(sig, pub_key), 0);
    }
}
`,
    constructorArgs: {
      pubKeyHash: ALICE.pubKeyHash,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Pay-to-Public-Key-Hash: locks funds to a public key hash, unlocks with signature.',
  },
  {
    id: 'go-p2pkh',
    name: 'P2PKH (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// P2PKH — Pay-to-Public-Key-Hash.
//
// The most fundamental Bitcoin spending pattern. Funds are locked to the
// HASH160 (SHA-256 → RIPEMD-160) of a public key. To spend, the recipient
// must provide their full public key (which must hash to the stored hash)
// and a valid ECDSA signature over the transaction.
//
// # How It Works: Two-Step Verification
//
//  1. Hash check — hash160(pubKey) == pubKeyHash proves the provided
//     public key matches the one committed to when the output was created.
//  2. Signature check — checkSig(sig, pubKey) proves the spender
//     holds the private key corresponding to that public key.
//
// This is the same pattern as standard Bitcoin P2PKH transactions, but
// expressed in the Rúnar smart contract language.
//
// # Script Layout
//
//	Unlocking: <sig> <pubKey>
//	Locking:   OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
//
// # Parameter Sizes
//
//   - pubKeyHash: 20 bytes (HASH160 of compressed public key)
//   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
//   - pubKey: 33 bytes (compressed secp256k1 public key)
type P2PKH struct {
	runar.SmartContract
	PubKeyHash runar.Addr \`runar:"readonly"\`
}

// Unlock verifies the pubKey hashes to the committed hash, then checks the signature.
func (c *P2PKH) Unlock(sig runar.Sig, pubKey runar.PubKey) {
	// Step 1: Verify pubKey matches the committed hash
	runar.Assert(runar.Hash160(pubKey) == c.PubKeyHash)
	// Step 2: Verify ECDSA signature proves ownership of the private key
	runar.Assert(runar.CheckSig(sig, pubKey))
}
`,
    constructorArgs: {
      pubKeyHash: ALICE.pubKeyHash,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Pay-to-Public-Key-Hash: locks funds to a public key hash, unlocks with signature.',
  },
  {
    id: 'rust-p2pkh',
    name: 'P2PKH (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// P2PKH — Pay-to-Public-Key-Hash.
///
/// The most fundamental Bitcoin spending pattern. Funds are locked to the
/// HASH160 (SHA-256 → RIPEMD-160) of a public key. To spend, the recipient
/// must provide their full public key (which must hash to the stored hash)
/// and a valid ECDSA signature over the transaction.
///
/// # How It Works: Two-Step Verification
///
///  1. **Hash check** — \`hash160(pub_key) == pub_key_hash\` proves the provided
///     public key matches the one committed to when the output was created.
///  2. **Signature check** — \`check_sig(sig, pub_key)\` proves the spender
///     holds the private key corresponding to that public key.
///
/// This is the same pattern as standard Bitcoin P2PKH transactions, but
/// expressed in the Rúnar smart contract language.
///
/// # Script Layout
///
///   Unlocking: \`<sig> <pubKey>\`
///   Locking:   \`OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG\`
///
/// # Parameter Sizes
///
///   - pub_key_hash: 20 bytes (HASH160 of compressed public key)
///   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
///   - pub_key: 33 bytes (compressed secp256k1 public key)
#[runar::contract]
pub struct P2PKH {
    #[readonly]
    pub pub_key_hash: Addr,
}

#[runar::methods(P2PKH)]
impl P2PKH {
    /// Unlock verifies the pub_key hashes to the committed hash, then checks the signature.
    #[public]
    pub fn unlock(&self, sig: &Sig, pub_key: &PubKey) {
        // Step 1: Verify pub_key matches the committed hash
        assert!(hash160(pub_key) == self.pub_key_hash);
        // Step 2: Verify ECDSA signature proves ownership of the private key
        assert!(check_sig(sig, pub_key));
    }
}
`,
    constructorArgs: {
      pubKeyHash: ALICE.pubKeyHash,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Pay-to-Public-Key-Hash: locks funds to a public key hash, unlocks with signature.',
  },
  {
    id: 'python-p2pkh',
    name: 'P2PKH (Python)',
    language: 'python',
    source: `from runar import SmartContract, Addr, Sig, PubKey, public, assert_, hash160, check_sig

class P2PKH(SmartContract):
    """P2PKH — Pay-to-Public-Key-Hash.

    The most fundamental Bitcoin spending pattern. Funds are locked to the
    HASH160 (SHA-256 then RIPEMD-160) of a public key. To spend, the recipient
    must provide their full public key (which must hash to the stored hash)
    and a valid ECDSA signature over the transaction.

    How It Works: Two-Step Verification

      1. Hash check — hash160(pub_key) == pub_key_hash proves the provided
         public key matches the one committed to when the output was created.
      2. Signature check — check_sig(sig, pub_key) proves the spender
         holds the private key corresponding to that public key.

    This is the same pattern as standard Bitcoin P2PKH transactions, but
    expressed in the Runar smart contract language.

    Script Layout:
      Unlocking: <sig> <pubKey>
      Locking:   OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG

    Parameter Sizes:
      - pub_key_hash: 20 bytes (HASH160 of compressed public key)
      - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
      - pub_key: 33 bytes (compressed secp256k1 public key)
    """
    pub_key_hash: Addr

    def __init__(self, pub_key_hash: Addr):
        super().__init__(pub_key_hash)
        self.pub_key_hash = pub_key_hash

    @public
    def unlock(self, sig: Sig, pub_key: PubKey):
        """Verify the pub_key hashes to the committed hash, then check the signature."""
        # Step 1: Verify pub_key matches the committed hash
        assert_(hash160(pub_key) == self.pub_key_hash)
        # Step 2: Verify ECDSA signature proves ownership of the private key
        assert_(check_sig(sig, pub_key))
`,
    constructorArgs: {
      pubKeyHash: ALICE.pubKeyHash,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Pay-to-Public-Key-Hash: locks funds to a public key hash, unlocks with signature.',
  },
  {
    id: 'ruby-p2pkh',
    name: 'P2PKH (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class P2PKH < Runar::SmartContract
  prop :pub_key_hash, Addr

  def initialize(pub_key_hash)
    super(pub_key_hash)
    @pub_key_hash = pub_key_hash
  end

  runar_public sig: Sig, pub_key: PubKey
  def unlock(sig, pub_key)
    assert hash160(pub_key) == @pub_key_hash
    assert check_sig(sig, pub_key)
  end
end
`,
    constructorArgs: {
      pubKeyHash: ALICE.pubKeyHash,
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Pay-to-Public-Key-Hash: locks funds to a public key hash, unlocks with signature.',
  },
  {
    id: 'sol-escrow',
    name: 'Escrow (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title Escrow
/// @notice Three-party escrow contract for marketplace payment protection.
/// @dev Holds funds in a UTXO until two parties jointly authorize a spend.
/// The buyer deposits funds by sending to this contract's locking script.
/// Two spending paths allow funds to move depending on the transaction outcome:
///
///   - release — seller + arbiter both sign to release funds to the seller
///     (e.g., goods delivered successfully).
///   - refund  — buyer + arbiter both sign to refund funds to the buyer
///     (e.g., dispute resolved in buyer's favor).
///
/// The arbiter serves as the trust anchor — no single party can act alone.
/// Both paths require two signatures (dual-sig), ensuring the arbiter must
/// co-sign every spend. This prevents unilateral action by either party.
///
/// Script layout:
///   Unlocking: <methodIndex> <sig1> <sig2>
///   Locking:   OP_IF <seller checkSig> <arbiter checkSig>
///              OP_ELSE <buyer checkSig> <arbiter checkSig> OP_ENDIF
contract Escrow is SmartContract {
    /// @notice Buyer's compressed public key (33 bytes).
    PubKey immutable buyer;
    /// @notice Seller's compressed public key (33 bytes).
    PubKey immutable seller;
    /// @notice Arbiter's compressed public key (33 bytes).
    PubKey immutable arbiter;

    /// @param _buyer   Buyer's compressed public key (33 bytes)
    /// @param _seller  Seller's compressed public key (33 bytes)
    /// @param _arbiter Arbiter's compressed public key (33 bytes)
    constructor(PubKey _buyer, PubKey _seller, PubKey _arbiter) {
        buyer = _buyer;
        seller = _seller;
        arbiter = _arbiter;
    }

    /// @notice Release escrowed funds to the seller.
    /// @param sellerSig Seller's signature
    /// @param arbiterSig Arbiter's signature
    function release(Sig sellerSig, Sig arbiterSig) public {
        require(checkSig(sellerSig, this.seller));
        require(checkSig(arbiterSig, this.arbiter));
    }

    /// @notice Refund escrowed funds to the buyer.
    /// @param buyerSig Buyer's signature
    /// @param arbiterSig Arbiter's signature
    function refund(Sig buyerSig, Sig arbiterSig) public {
        require(checkSig(buyerSig, this.buyer));
        require(checkSig(arbiterSig, this.arbiter));
    }
}
`,
    constructorArgs: {
      buyer: ALICE.pubKey,
      seller: BOB.pubKey,
      arbiter: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'release',
      args: [
        { type: 'Sig', signer: 'bob' },
        { type: 'Sig', signer: 'charlie' },
      ],
    },
    description: 'Three-party escrow: seller + arbiter sign to release, buyer + arbiter sign to refund.',
  },
  {
    id: 'move-escrow',
    name: 'Escrow (Move)',
    language: 'move',
    source: `// Three-party escrow contract for marketplace payment protection.
//
// Holds funds in a UTXO until two parties jointly authorize a spend.
// The buyer deposits funds by sending to this contract's locking script.
// Two spending paths allow funds to move depending on the transaction outcome:
//
//   - release — seller + arbiter both sign to release funds to the seller
//     (e.g., goods delivered successfully).
//   - refund  — buyer + arbiter both sign to refund funds to the buyer
//     (e.g., dispute resolved in buyer's favor).
//
// The arbiter serves as the trust anchor — no single party can act alone.
// Both paths require two signatures (dual-sig), ensuring the arbiter must
// co-sign every spend. This prevents unilateral action by either party.
//
// Script layout:
//   Unlocking: <methodIndex> <sig1> <sig2>
//   Locking:   OP_IF <seller checkSig> <arbiter checkSig>
//              OP_ELSE <buyer checkSig> <arbiter checkSig> OP_ENDIF
module Escrow {
    use runar::types::{PubKey, Sig};
    use runar::crypto::{check_sig};

    resource struct Escrow {
        // Buyer's compressed public key (33 bytes).
        buyer: PubKey,
        // Seller's compressed public key (33 bytes).
        seller: PubKey,
        // Arbiter's compressed public key (33 bytes).
        arbiter: PubKey,
    }

    // Release escrowed funds to the seller.
    // Requires both the seller's and arbiter's signatures.
    public fun release(contract: &Escrow, seller_sig: Sig, arbiter_sig: Sig) {
        assert!(check_sig(seller_sig, contract.seller), 0);
        assert!(check_sig(arbiter_sig, contract.arbiter), 0);
    }

    // Refund escrowed funds to the buyer.
    // Requires both the buyer's and arbiter's signatures.
    public fun refund(contract: &Escrow, buyer_sig: Sig, arbiter_sig: Sig) {
        assert!(check_sig(buyer_sig, contract.buyer), 0);
        assert!(check_sig(arbiter_sig, contract.arbiter), 0);
    }
}
`,
    constructorArgs: {
      buyer: ALICE.pubKey,
      seller: BOB.pubKey,
      arbiter: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'release',
      args: [
        { type: 'Sig', signer: 'bob' },
        { type: 'Sig', signer: 'charlie' },
      ],
    },
    description: 'Three-party escrow: seller + arbiter sign to release, buyer + arbiter sign to refund.',
  },
  {
    id: 'go-escrow',
    name: 'Escrow (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// Escrow is a three-party escrow contract for marketplace payment protection.
//
// Holds funds in a UTXO until two parties jointly authorize a spend. The buyer
// deposits funds by sending to this contract's locking script. Two spending
// paths allow funds to move depending on the transaction outcome:
//
//   - Release — seller + arbiter both sign to release funds to the seller
//     (e.g., goods delivered successfully).
//   - Refund  — buyer + arbiter both sign to refund funds to the buyer
//     (e.g., dispute resolved in buyer's favor).
//
// The arbiter serves as the trust anchor — no single party can act alone.
// Both paths require two signatures (dual-sig), ensuring the arbiter must
// co-sign every spend. This prevents unilateral action by either party.
//
// Script layout:
//
//	Unlocking: <methodIndex> <sig1> <sig2>
//	Locking:   OP_IF <seller checkSig> <arbiter checkSig>
//	           OP_ELSE <buyer checkSig> <arbiter checkSig> OP_ENDIF
//
// This is a stateless contract (SmartContract). The three public keys are
// readonly constructor parameters baked into the locking script at deploy time.
type Escrow struct {
	runar.SmartContract
	// Buyer is the buyer's compressed public key (33 bytes).
	Buyer runar.PubKey \`runar:"readonly"\`
	// Seller is the seller's compressed public key (33 bytes).
	Seller runar.PubKey \`runar:"readonly"\`
	// Arbiter is the arbiter's compressed public key (33 bytes).
	Arbiter runar.PubKey \`runar:"readonly"\`
}

// Release releases escrowed funds to the seller.
// Requires both the seller's and arbiter's signatures.
func (c *Escrow) Release(sellerSig runar.Sig, arbiterSig runar.Sig) {
	runar.Assert(runar.CheckSig(sellerSig, c.Seller))
	runar.Assert(runar.CheckSig(arbiterSig, c.Arbiter))
}

// Refund refunds escrowed funds to the buyer.
// Requires both the buyer's and arbiter's signatures.
func (c *Escrow) Refund(buyerSig runar.Sig, arbiterSig runar.Sig) {
	runar.Assert(runar.CheckSig(buyerSig, c.Buyer))
	runar.Assert(runar.CheckSig(arbiterSig, c.Arbiter))
}
`,
    constructorArgs: {
      buyer: ALICE.pubKey,
      seller: BOB.pubKey,
      arbiter: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'release',
      args: [
        { type: 'Sig', signer: 'bob' },
        { type: 'Sig', signer: 'charlie' },
      ],
    },
    description: 'Three-party escrow: seller + arbiter sign to release, buyer + arbiter sign to refund.',
  },
  {
    id: 'rust-escrow',
    name: 'Escrow (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// Three-party escrow contract for marketplace payment protection.
///
/// Holds funds in a UTXO until two parties jointly authorize a spend.
/// The buyer deposits funds by sending to this contract's locking script.
/// Two spending paths allow funds to move depending on the transaction outcome:
///
/// - [\`release\`] — seller + arbiter both sign to release funds to the seller
///   (e.g., goods delivered successfully).
/// - [\`refund\`]  — buyer + arbiter both sign to refund funds to the buyer
///   (e.g., dispute resolved in buyer's favor).
///
/// The arbiter serves as the trust anchor — no single party can act alone.
/// Both paths require two signatures (dual-sig), ensuring the arbiter must
/// co-sign every spend. This prevents unilateral action by either party.
///
/// Script layout:
/// \`\`\`text
/// Unlocking: <methodIndex> <sig1> <sig2>
/// Locking:   OP_IF <seller checkSig> <arbiter checkSig>
///            OP_ELSE <buyer checkSig> <arbiter checkSig> OP_ENDIF
/// \`\`\`
#[runar::contract]
pub struct Escrow {
    /// Buyer's compressed public key (33 bytes).
    #[readonly]
    pub buyer: PubKey,
    /// Seller's compressed public key (33 bytes).
    #[readonly]
    pub seller: PubKey,
    /// Arbiter's compressed public key (33 bytes).
    #[readonly]
    pub arbiter: PubKey,
}

#[runar::methods(Escrow)]
impl Escrow {
    /// Release escrowed funds to the seller.
    /// Requires both the seller's and arbiter's signatures.
    #[public]
    pub fn release(&self, seller_sig: &Sig, arbiter_sig: &Sig) {
        assert!(check_sig(seller_sig, &self.seller));
        assert!(check_sig(arbiter_sig, &self.arbiter));
    }

    /// Refund escrowed funds to the buyer.
    /// Requires both the buyer's and arbiter's signatures.
    #[public]
    pub fn refund(&self, buyer_sig: &Sig, arbiter_sig: &Sig) {
        assert!(check_sig(buyer_sig, &self.buyer));
        assert!(check_sig(arbiter_sig, &self.arbiter));
    }
}
`,
    constructorArgs: {
      buyer: ALICE.pubKey,
      seller: BOB.pubKey,
      arbiter: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'release',
      args: [
        { type: 'Sig', signer: 'bob' },
        { type: 'Sig', signer: 'charlie' },
      ],
    },
    description: 'Three-party escrow: seller + arbiter sign to release, buyer + arbiter sign to refund.',
  },
  {
    id: 'python-escrow',
    name: 'Escrow (Python)',
    language: 'python',
    source: `from runar import SmartContract, PubKey, Sig, public, assert_, check_sig


class Escrow(SmartContract):
    """Three-party escrow contract for marketplace payment protection.

    Holds funds in a UTXO until two parties jointly authorize a spend. The buyer
    deposits funds by sending to this contract's locking script. Two spending
    paths allow funds to move depending on the transaction outcome:

    - release -- seller + arbiter both sign to release funds to the seller
      (e.g., goods delivered successfully).
    - refund  -- buyer + arbiter both sign to refund funds to the buyer
      (e.g., dispute resolved in buyer's favor).

    The arbiter serves as the trust anchor -- no single party can act alone.
    Both paths require two signatures (dual-sig), ensuring the arbiter must
    co-sign every spend. This prevents unilateral action by either party.

    Script layout::

        Unlocking: <methodIndex> <sig1> <sig2>
        Locking:   OP_IF <seller checkSig> <arbiter checkSig>
                   OP_ELSE <buyer checkSig> <arbiter checkSig> OP_ENDIF

    Args:
        buyer:   Buyer's compressed public key (33 bytes).
        seller:  Seller's compressed public key (33 bytes).
        arbiter: Arbiter's compressed public key (33 bytes).
    """

    buyer: PubKey
    seller: PubKey
    arbiter: PubKey

    def __init__(self, buyer: PubKey, seller: PubKey, arbiter: PubKey):
        super().__init__(buyer, seller, arbiter)
        self.buyer = buyer
        self.seller = seller
        self.arbiter = arbiter

    @public
    def release(self, seller_sig: Sig, arbiter_sig: Sig):
        """Release escrowed funds to the seller.

        Requires both the seller's and arbiter's signatures.

        Args:
            seller_sig: Seller's signature.
            arbiter_sig: Arbiter's signature.
        """
        assert_(check_sig(seller_sig, self.seller))
        assert_(check_sig(arbiter_sig, self.arbiter))

    @public
    def refund(self, buyer_sig: Sig, arbiter_sig: Sig):
        """Refund escrowed funds to the buyer.

        Requires both the buyer's and arbiter's signatures.

        Args:
            buyer_sig: Buyer's signature.
            arbiter_sig: Arbiter's signature.
        """
        assert_(check_sig(buyer_sig, self.buyer))
        assert_(check_sig(arbiter_sig, self.arbiter))
`,
    constructorArgs: {
      buyer: ALICE.pubKey,
      seller: BOB.pubKey,
      arbiter: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'release',
      args: [
        { type: 'Sig', signer: 'bob' },
        { type: 'Sig', signer: 'charlie' },
      ],
    },
    description: 'Three-party escrow: seller + arbiter sign to release, buyer + arbiter sign to refund.',
  },
  {
    id: 'ruby-escrow',
    name: 'Escrow (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class Escrow < Runar::SmartContract
  prop :buyer, PubKey
  prop :seller, PubKey
  prop :arbiter, PubKey

  def initialize(buyer, seller, arbiter)
    super(buyer, seller, arbiter)
    @buyer = buyer
    @seller = seller
    @arbiter = arbiter
  end

  runar_public seller_sig: Sig, arbiter_sig: Sig
  def release(seller_sig, arbiter_sig)
    assert check_sig(seller_sig, @seller)
    assert check_sig(arbiter_sig, @arbiter)
  end

  runar_public buyer_sig: Sig, arbiter_sig: Sig
  def refund(buyer_sig, arbiter_sig)
    assert check_sig(buyer_sig, @buyer)
    assert check_sig(arbiter_sig, @arbiter)
  end
end
`,
    constructorArgs: {
      buyer: ALICE.pubKey,
      seller: BOB.pubKey,
      arbiter: CHARLIE.pubKey,
    },
    methodCall: {
      method: 'release',
      args: [
        { type: 'Sig', signer: 'bob' },
        { type: 'Sig', signer: 'charlie' },
      ],
    },
    description: 'Three-party escrow: seller + arbiter sign to release, buyer + arbiter sign to refund.',
  },
  {
    id: 'sol-stateful-counter',
    name: 'Counter (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title Counter
/// @notice The simplest possible stateful smart contract.
/// @dev Demonstrates Rúnar's state management: a counter that persists its
/// value across spending transactions on the Bitcoin SV blockchain.
///
/// Because this contract inherits StatefulSmartContract, the compiler
/// automatically injects:
///   - \`checkPreimage\` at each public function entry — verifies the spending
///     transaction matches the sighash preimage.
///   - State continuation at each public function exit — serializes updated
///     state into the new output script.
///
/// Script layout (on-chain):
///   Locking: <contract logic> OP_RETURN <count>
///
/// The state (\`count\`) is serialized as push data after OP_RETURN. When spent,
/// the compiler-injected preimage check ensures the new output carries the
/// correct updated state.
///
/// No authorization checks. This contract is intentionally minimal for
/// educational purposes — anyone can call increment or decrement. A real
/// stateful contract would include signature verification or other access
/// control.
contract Counter is StatefulSmartContract {
    bigint count; // mutable (stateful, persists across transactions)

    constructor(bigint _count) {
        count = _count;
    }

    /// @notice Increments count by 1. Anyone can call this function.
    function increment() public {
        this.count++;
    }

    /// @notice Decrements count by 1.
    /// @dev Asserts count > 0 to prevent underflow. Anyone can call this function.
    function decrement() public {
        require(this.count > 0);
        this.count--;
    }
}
`,
    constructorArgs: {
      count: 0n,
    },
    methodCall: {
      method: 'increment',
      args: [],
    },
    description: 'Simplest stateful contract: a counter that persists across transactions.',
  },
  {
    id: 'move-stateful-counter',
    name: 'Counter (Move)',
    language: 'move',
    source: `// Counter — the simplest possible stateful smart contract.
//
// Demonstrates Rúnar's state management: a counter that persists its value
// across spending transactions on the Bitcoin SV blockchain.
//
// Because Counter is declared as a \`resource struct\`, the compiler
// automatically injects:
//   - checkPreimage at each public function entry — verifies the spending
//     transaction matches the sighash preimage.
//   - State continuation at each public function exit — serializes updated
//     state into the new output script.
//
// Script layout (on-chain):
//   Locking: <contract logic> OP_RETURN <count>
//
// The state (count) is serialized as push data after OP_RETURN. When spent,
// the compiler-injected preimage check ensures the new output carries the
// correct updated state.
//
// No authorization checks. This contract is intentionally minimal for
// educational purposes — anyone can call increment or decrement. A real
// stateful contract would include signature verification or other access
// control.
module Counter {
    resource struct Counter {
        count: bigint, // mutable (stateful, persists across transactions)
    }

    // Increments count by 1. Anyone can call this function.
    public fun increment(contract: &mut Counter) {
        contract.count = contract.count + 1;
    }

    // Decrements count by 1.
    // Asserts count > 0 to prevent underflow. Anyone can call this function.
    public fun decrement(contract: &mut Counter) {
        assert!(contract.count > 0, 0);
        contract.count = contract.count - 1;
    }
}
`,
    constructorArgs: {
      count: 0n,
    },
    methodCall: {
      method: 'increment',
      args: [],
    },
    description: 'Simplest stateful contract: a counter that persists across transactions.',
  },
  {
    id: 'go-stateful-counter',
    name: 'Counter (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// Counter — the simplest possible stateful smart contract.
//
// Demonstrates Rúnar's state management: a counter that persists its value
// across spending transactions on the Bitcoin SV blockchain.
//
// Because this struct embeds runar.StatefulSmartContract, the compiler
// automatically injects:
//   - checkPreimage at each public method entry — verifies the spending
//     transaction matches the sighash preimage.
//   - State continuation at each public method exit — serializes updated
//     state into the new output script.
//
// Script layout (on-chain):
//
//	Locking: <contract logic> OP_RETURN <count>
//
// The state (Count) is serialized as push data after OP_RETURN. When spent,
// the compiler-injected preimage check ensures the new output carries the
// correct updated state.
//
// No authorization checks. This contract is intentionally minimal for
// educational purposes — anyone can call Increment or Decrement. A real
// stateful contract would include signature verification or other access
// control.
type Counter struct {
	runar.StatefulSmartContract
	Count runar.Bigint // no tag = mutable (stateful, persists across transactions)
}

// Increment increments Count by 1. Anyone can call this method.
func (c *Counter) Increment() {
	c.Count++
}

// Decrement decrements Count by 1.
// Asserts Count > 0 to prevent underflow. Anyone can call this method.
func (c *Counter) Decrement() {
	runar.Assert(c.Count > 0)
	c.Count--
}
`,
    constructorArgs: {
      count: 0n,
    },
    methodCall: {
      method: 'increment',
      args: [],
    },
    description: 'Simplest stateful contract: a counter that persists across transactions.',
  },
  {
    id: 'rust-stateful-counter',
    name: 'Counter (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// Counter — the simplest possible stateful smart contract.
///
/// Demonstrates Rúnar's state management: a counter that persists its value
/// across spending transactions on the Bitcoin SV blockchain.
///
/// Because this struct uses \`#[runar::contract]\` (without \`#[readonly]\` on
/// \`count\`), the compiler automatically injects:
///   - \`checkPreimage\` at each public method entry — verifies the spending
///     transaction matches the sighash preimage.
///   - State continuation at each public method exit — serializes updated
///     state into the new output script.
///
/// **Script layout (on-chain):**
/// \`\`\`text
/// Locking: <contract logic> OP_RETURN <count>
/// \`\`\`
/// The state (\`count\`) is serialized as push data after \`OP_RETURN\`. When
/// spent, the compiler-injected preimage check ensures the new output carries
/// the correct updated state.
///
/// **No authorization checks.** This contract is intentionally minimal for
/// educational purposes — anyone can call increment or decrement. A real
/// stateful contract would include signature verification or other access
/// control.
#[runar::contract]
pub struct Counter {
    // No #[readonly] = mutable (stateful, persists across transactions)
    pub count: Bigint,
}

#[runar::methods(Counter)]
impl Counter {
    /// Increments count by 1. Anyone can call this method.
    #[public]
    pub fn increment(&mut self) {
        self.count += 1;
    }

    /// Decrements count by 1.
    /// Asserts count > 0 to prevent underflow. Anyone can call this method.
    #[public]
    pub fn decrement(&mut self) {
        assert!(self.count > 0);
        self.count -= 1;
    }
}
`,
    constructorArgs: {
      count: 0n,
    },
    methodCall: {
      method: 'increment',
      args: [],
    },
    description: 'Simplest stateful contract: a counter that persists across transactions.',
  },
  {
    id: 'python-stateful-counter',
    name: 'Counter (Python)',
    language: 'python',
    source: `from runar import StatefulSmartContract, Bigint, public, assert_


class Counter(StatefulSmartContract):
    """Counter -- the simplest possible stateful smart contract.

    Demonstrates Runar's state management: a counter that persists its value
    across spending transactions on the Bitcoin SV blockchain.

    Because this class extends StatefulSmartContract, the compiler automatically
    injects:
      - checkPreimage at each public method entry -- verifies the spending
        transaction matches the sighash preimage.
      - State continuation at each public method exit -- serializes updated
        state into the new output script.

    Script layout (on-chain)::

        Locking: <contract logic> OP_RETURN <count>

    The state (count) is serialized as push data after OP_RETURN. When spent,
    the compiler-injected preimage check ensures the new output carries the
    correct updated state.

    No authorization checks. This contract is intentionally minimal for
    educational purposes -- anyone can call increment or decrement. A real
    stateful contract would include signature verification or other access
    control.
    """

    count: Bigint  # mutable (stateful, persists across transactions)

    def __init__(self, count: Bigint):
        super().__init__(count)
        self.count = count

    @public
    def increment(self):
        """Increments count by 1. Anyone can call this method."""
        self.count += 1

    @public
    def decrement(self):
        """Decrements count by 1.

        Asserts count > 0 to prevent underflow. Anyone can call this method.
        """
        assert_(self.count > 0)
        self.count -= 1
`,
    constructorArgs: {
      count: 0n,
    },
    methodCall: {
      method: 'increment',
      args: [],
    },
    description: 'Simplest stateful contract: a counter that persists across transactions.',
  },
  {
    id: 'ruby-stateful-counter',
    name: 'Counter (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class Counter < Runar::StatefulSmartContract
  prop :count, Bigint

  def initialize(count)
    super(count)
    @count = count
  end

  runar_public
  def increment
    @count += 1
  end

  runar_public
  def decrement
    assert @count > 0
    @count -= 1
  end
end
`,
    constructorArgs: {
      count: 0n,
    },
    methodCall: {
      method: 'increment',
      args: [],
    },
    description: 'Simplest stateful contract: a counter that persists across transactions.',
  },
  {
    id: 'sol-auction',
    name: 'Auction (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title Auction
/// @notice On-chain English auction contract.
/// Bidders compete by submitting progressively higher bids until a block-height
/// deadline. After the deadline, only the auctioneer can close the auction.
///
/// Lifecycle:
///   1. The auctioneer deploys the contract with themselves as the initial
///      highest bidder, a highest bid of 0, and a block-height deadline.
///   2. Anyone calls \`bid()\` to outbid the current leader. Each successful bid
///      creates a new UTXO carrying the updated state.
///   3. Once the deadline has passed, the auctioneer calls \`close()\` to
///      finalize the auction and spend the UTXO.
///
/// Stateful mechanics:
///   Extends StatefulSmartContract. The compiler auto-injects checkPreimage at
///   method entry and a state-continuation output at method exit for
///   state-mutating methods. Each continuation UTXO encodes state as:
///     OP_RETURN <auctioneer> <highestBidder> <highestBid> <deadline>
///
/// Time enforcement:
///   Uses Bitcoin's native nLockTime mechanism via extractLocktime(). Miners
///   will not include a transaction whose locktime is in the future, so the
///   deadline is enforced at the consensus level.
contract Auction is StatefulSmartContract {
    PubKey immutable auctioneer;    /// @dev Auction creator's public key. Immutable — baked into script at deploy time.
    PubKey highestBidder;           /// @dev Current highest bidder. Mutable state persisted across transactions.
    bigint highestBid;              /// @dev Current highest bid in satoshis. Mutable state persisted across transactions.
    bigint immutable deadline;      /// @dev Block height after which no more bids are accepted. Immutable.

    constructor(PubKey _auctioneer, PubKey _highestBidder, bigint _highestBid, bigint _deadline) {
        auctioneer = _auctioneer;
        highestBidder = _highestBidder;
        highestBid = _highestBid;
        deadline = _deadline;
    }

    /// @notice Submit a new bid that outbids the current highest.
    /// @dev State-mutating: the compiler auto-injects checkPreimage at entry and
    /// appends a state-continuation output at exit, creating a new UTXO with
    /// the updated highestBidder and highestBid.
    /// @param sig Bidder's signature proving they authorized this bid.
    /// @param bidder Public key of the new bidder.
    /// @param bidAmount Bid in satoshis; must exceed the current highest bid.
    function bid(Sig sig, PubKey bidder, bigint bidAmount) public {
        // Verify the bidder authorized this bid (prevents griefing)
        require(checkSig(sig, bidder));

        // Reject bids that do not exceed the current highest
        require(bidAmount > this.highestBid);

        // Enforce that the auction is still open: nLockTime must be before the deadline
        require(extractLocktime(this.txPreimage) < this.deadline);

        // Persist new leader into on-chain state
        this.highestBidder = bidder;
        this.highestBid = bidAmount;
    }

    /// @notice Close the auction after the deadline has passed.
    /// @dev Non-mutating: the compiler auto-injects checkPreimage but does NOT
    /// append a state-continuation output, so the UTXO is fully spent (no
    /// successor). Only the auctioneer may call this.
    /// @param sig Signature from the auctioneer proving ownership.
    function close(Sig sig) public {
        // Verify the caller is the auctioneer
        require(checkSig(sig, this.auctioneer));

        // Enforce that the deadline has passed: nLockTime must be >= deadline
        require(extractLocktime(this.txPreimage) >= this.deadline);
    }
}
`,
    constructorArgs: {
      auctioneer: ALICE.pubKey,
      highestBidder: BOB.pubKey,
      highestBid: 0n,
      deadline: 500000n,
    },
    methodCall: {
      method: 'close',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'On-chain English auction with block-height deadline. Auctioneer closes after deadline.',
  },
  {
    id: 'move-auction',
    name: 'Auction (Move)',
    language: 'move',
    source: `// On-chain English auction contract.
//
// Bidders compete by submitting progressively higher bids until a block-height
// deadline. After the deadline, only the auctioneer can close the auction.
//
// Lifecycle:
//   1. The auctioneer deploys the contract with themselves as the initial
//      highest bidder, a highest bid of 0, and a block-height deadline.
//   2. Anyone calls \`bid\` to outbid the current leader. Each successful bid
//      creates a new UTXO carrying the updated state.
//   3. Once the deadline has passed, the auctioneer calls \`close\` to finalize
//      the auction and spend the UTXO.
//
// Stateful mechanics:
//   Uses \`resource struct\` with StatefulSmartContract semantics. The compiler
//   auto-injects checkPreimage at method entry and a state-continuation output
//   at method exit for state-mutating methods. Each continuation UTXO encodes
//   state as:
//     OP_RETURN <auctioneer> <highest_bidder> <highest_bid> <deadline>
//
// Time enforcement:
//   Uses Bitcoin's native nLockTime mechanism via \`extract_locktime\`. Miners
//   will not include a transaction whose locktime is in the future, so the
//   deadline is enforced at the consensus level.
module Auction {
    use runar::types::{PubKey, Sig};
    use runar::crypto::{check_sig, extract_locktime};

    resource struct Auction {
        auctioneer: PubKey,         // Auction creator's public key. Immutable — baked into script.
        highest_bidder: PubKey,     // Current highest bidder. Mutable state across transactions.
        highest_bid: bigint,        // Current highest bid in satoshis. Mutable state.
        deadline: bigint,           // Block height cutoff. Immutable.
    }

    // Submit a new bid that outbids the current highest.
    //
    // State-mutating: the compiler auto-injects checkPreimage at entry and
    // appends a state-continuation output at exit, creating a new UTXO with
    // the updated highest_bidder and highest_bid.
    //
    // Parameters:
    //   sig        - Bidder's signature proving they authorized this bid.
    //   bidder     - Public key of the new bidder.
    //   bid_amount - Bid in satoshis; must exceed the current highest bid.
    public fun bid(contract: &mut Auction, sig: Sig, bidder: PubKey, bid_amount: bigint) {
        // Verify the bidder authorized this bid (prevents griefing)
        assert!(check_sig(sig, bidder), 0);

        // Reject bids that do not exceed the current highest
        assert!(bid_amount > contract.highest_bid, 0);

        // Enforce that the auction is still open: nLockTime must be before the deadline
        assert!(extract_locktime(contract.tx_preimage) < contract.deadline, 0);

        // Persist new leader into on-chain state
        contract.highest_bidder = bidder;
        contract.highest_bid = bid_amount;
    }

    // Close the auction after the deadline has passed.
    //
    // Non-mutating: the compiler auto-injects checkPreimage but does NOT append
    // a state-continuation output, so the UTXO is fully spent (no successor).
    // Only the auctioneer may call this.
    //
    // Parameters:
    //   sig - Signature from the auctioneer proving ownership.
    public fun close(contract: &mut Auction, sig: Sig) {
        // Verify the caller is the auctioneer
        assert!(check_sig(sig, contract.auctioneer), 0);

        // Enforce that the deadline has passed: nLockTime must be >= deadline
        assert!(extract_locktime(contract.tx_preimage) >= contract.deadline, 0);
    }
}
`,
    constructorArgs: {
      auctioneer: ALICE.pubKey,
      highestBidder: BOB.pubKey,
      highestBid: 0n,
      deadline: 500000n,
    },
    methodCall: {
      method: 'close',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'On-chain English auction with block-height deadline. Auctioneer closes after deadline.',
  },
  {
    id: 'go-auction',
    name: 'Auction (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// Auction is an on-chain English auction contract.
//
// Bidders compete by submitting progressively higher bids until a block-height
// deadline. After the deadline, only the auctioneer can close the auction.
//
// Lifecycle:
//  1. The auctioneer deploys the contract with themselves as the initial highest
//     bidder, a highest bid of 0, and a block-height deadline.
//  2. Anyone calls Bid to outbid the current leader. Each successful bid creates
//     a new UTXO carrying the updated state.
//  3. Once the deadline has passed, the auctioneer calls Close to finalize the
//     auction and spend the UTXO.
//
// Stateful mechanics:
// Embeds StatefulSmartContract. The compiler auto-injects checkPreimage at
// method entry and a state-continuation output at method exit for
// state-mutating methods. Each continuation UTXO encodes state as:
//
//	OP_RETURN <Auctioneer> <HighestBidder> <HighestBid> <Deadline>
//
// Time enforcement:
// Uses Bitcoin's native nLockTime mechanism via ExtractLocktime. Miners will
// not include a transaction whose locktime is in the future, so the deadline
// is enforced at the consensus level.
type Auction struct {
	runar.StatefulSmartContract
	Auctioneer    runar.PubKey \`runar:"readonly"\` // Auction creator's public key. Immutable — baked into the script at deploy time.
	HighestBidder runar.PubKey                     // Current highest bidder's public key. Mutable state persisted across transactions.
	HighestBid    runar.Bigint                     // Current highest bid in satoshis. Mutable state persisted across transactions.
	Deadline      runar.Bigint \`runar:"readonly"\`  // Block height after which no more bids are accepted. Immutable.
}

// Bid submits a new bid that outbids the current highest.
//
// State-mutating: the compiler auto-injects checkPreimage at entry and appends
// a state-continuation output at exit, creating a new UTXO with the updated
// HighestBidder and HighestBid.
//
// Parameters:
//   - sig:       bidder's signature proving they authorized this bid.
//   - bidder:    public key of the new bidder.
//   - bidAmount: bid in satoshis; must exceed the current highest bid.
func (c *Auction) Bid(sig runar.Sig, bidder runar.PubKey, bidAmount runar.Bigint) {
	// Verify the bidder authorized this bid (prevents griefing)
	runar.Assert(runar.CheckSig(sig, bidder))

	// Reject bids that do not exceed the current highest
	runar.Assert(bidAmount > c.HighestBid)

	// Enforce that the auction is still open: the spending transaction's
	// nLockTime (extracted from the sighash preimage) must be before the deadline
	runar.Assert(runar.ExtractLocktime(c.TxPreimage) < c.Deadline)

	// Persist new leader into on-chain state
	c.HighestBidder = bidder
	c.HighestBid = bidAmount
}

// Close finalizes the auction after the deadline has passed.
//
// Non-mutating: the compiler auto-injects checkPreimage but does NOT append a
// state-continuation output, so the UTXO is fully spent (no successor). Only
// the auctioneer may call this.
//
// Parameters:
//   - sig: signature from the auctioneer proving ownership.
func (c *Auction) Close(sig runar.Sig) {
	// Verify the caller is the auctioneer
	runar.Assert(runar.CheckSig(sig, c.Auctioneer))

	// Enforce that the deadline has passed: nLockTime must be >= Deadline
	runar.Assert(runar.ExtractLocktime(c.TxPreimage) >= c.Deadline)
}
`,
    constructorArgs: {
      auctioneer: ALICE.pubKey,
      highestBidder: BOB.pubKey,
      highestBid: 0n,
      deadline: 500000n,
    },
    methodCall: {
      method: 'close',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'On-chain English auction with block-height deadline. Auctioneer closes after deadline.',
  },
  {
    id: 'rust-auction',
    name: 'Auction (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// On-chain English auction contract.
///
/// Bidders compete by submitting progressively higher bids until a block-height
/// deadline. After the deadline, only the auctioneer can close the auction.
///
/// # Lifecycle
///
/// 1. The auctioneer deploys the contract with themselves as the initial highest
///    bidder, a highest bid of 0, and a block-height deadline.
/// 2. Anyone calls [\`bid\`](Auction::bid) to outbid the current leader. Each
///    successful bid creates a new UTXO carrying the updated state.
/// 3. Once the deadline has passed, the auctioneer calls [\`close\`](Auction::close)
///    to finalize the auction and spend the UTXO.
///
/// # Stateful mechanics
///
/// Uses \`#[runar::contract]\` with \`StatefulSmartContract\` semantics. The compiler
/// auto-injects \`checkPreimage\` at method entry and a state-continuation output at
/// method exit for state-mutating methods. Each continuation UTXO encodes state as:
///
/// \`\`\`text
/// OP_RETURN <auctioneer> <highest_bidder> <highest_bid> <deadline>
/// \`\`\`
///
/// # Time enforcement
///
/// Uses Bitcoin's native nLockTime mechanism via [\`extract_locktime\`]. Miners will
/// not include a transaction whose locktime is in the future, so the deadline is
/// enforced at the consensus level.
#[runar::contract]
pub struct Auction {
    /// Auction creator's public key. Immutable — baked into the script at deploy time.
    #[readonly]
    pub auctioneer: PubKey,
    /// Current highest bidder's public key. Mutable state persisted across transactions.
    pub highest_bidder: PubKey,
    /// Current highest bid in satoshis. Mutable state persisted across transactions.
    pub highest_bid: Bigint,
    /// Block height after which no more bids are accepted. Immutable.
    #[readonly]
    pub deadline: Bigint,
    /// Sighash preimage injected by the compiler for \`checkPreimage\` verification.
    pub tx_preimage: SigHashPreimage,
}

#[runar::methods(Auction)]
impl Auction {
    /// Submit a new bid that outbids the current highest.
    ///
    /// State-mutating: the compiler auto-injects \`checkPreimage\` at entry and
    /// appends a state-continuation output at exit, creating a new UTXO with
    /// the updated \`highest_bidder\` and \`highest_bid\`.
    ///
    /// # Arguments
    ///
    /// * \`sig\`        - Bidder's signature proving they authorized this bid.
    /// * \`bidder\`     - Public key of the new bidder.
    /// * \`bid_amount\` - Bid in satoshis; must exceed the current highest bid.
    #[public]
    pub fn bid(&mut self, sig: &Sig, bidder: PubKey, bid_amount: Bigint) {
        // Verify the bidder authorized this bid (prevents griefing)
        assert!(check_sig(sig, &bidder));

        // Reject bids that do not exceed the current highest
        assert!(bid_amount > self.highest_bid);
        // Enforce that the auction is still open: nLockTime must be before the deadline
        assert!(extract_locktime(&self.tx_preimage) < self.deadline);
        // Persist new leader into on-chain state
        self.highest_bidder = bidder;
        self.highest_bid = bid_amount;
    }

    /// Close the auction after the deadline has passed.
    ///
    /// Non-mutating: the compiler auto-injects \`checkPreimage\` but does NOT
    /// append a state-continuation output, so the UTXO is fully spent (no
    /// successor). Only the auctioneer may call this.
    ///
    /// # Arguments
    ///
    /// * \`sig\` - Signature from the auctioneer proving ownership.
    #[public]
    pub fn close(&self, sig: &Sig) {
        // Verify the caller is the auctioneer
        assert!(check_sig(sig, &self.auctioneer));
        // Enforce that the deadline has passed: nLockTime must be >= deadline
        assert!(extract_locktime(&self.tx_preimage) >= self.deadline);
    }
}
`,
    constructorArgs: {
      auctioneer: ALICE.pubKey,
      highestBidder: BOB.pubKey,
      highestBid: 0n,
      deadline: 500000n,
    },
    methodCall: {
      method: 'close',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'On-chain English auction with block-height deadline. Auctioneer closes after deadline.',
  },
  {
    id: 'python-auction',
    name: 'Auction (Python)',
    language: 'python',
    source: `from runar import (
    StatefulSmartContract, PubKey, Sig, Bigint, Readonly,
    public, assert_, check_sig, extract_locktime,
)


class Auction(StatefulSmartContract):
    """On-chain English auction contract.

    Bidders compete by submitting progressively higher bids until a block-height
    deadline. After the deadline, only the auctioneer can close the auction.

    Lifecycle:
        1. The auctioneer deploys the contract with themselves as the initial
           highest bidder, a highest bid of 0, and a block-height deadline.
        2. Anyone calls :meth:\`bid\` to outbid the current leader. Each successful
           bid creates a new UTXO carrying the updated state.
        3. Once the deadline has passed, the auctioneer calls :meth:\`close\` to
           finalize the auction and spend the UTXO.

    Stateful mechanics:
        Extends :class:\`StatefulSmartContract\`. The compiler auto-injects
        \`\`checkPreimage\`\` at method entry and a state-continuation output at
        method exit for state-mutating methods. Each continuation UTXO encodes
        state as::

            OP_RETURN <auctioneer> <highest_bidder> <highest_bid> <deadline>

    Time enforcement:
        Uses Bitcoin's native nLockTime mechanism via :func:\`extract_locktime\`.
        Miners will not include a transaction whose locktime is in the future,
        so the deadline is enforced at the consensus level.
    """

    auctioneer: Readonly[PubKey]      # Auction creator's public key. Immutable — baked into script.
    highest_bidder: PubKey             # Current highest bidder. Mutable state across transactions.
    highest_bid: Bigint                # Current highest bid in satoshis. Mutable state.
    deadline: Readonly[Bigint]         # Block height cutoff. Immutable.

    def __init__(self, auctioneer: PubKey, highest_bidder: PubKey,
                 highest_bid: Bigint, deadline: Bigint):
        super().__init__(auctioneer, highest_bidder, highest_bid, deadline)
        self.auctioneer = auctioneer
        self.highest_bidder = highest_bidder
        self.highest_bid = highest_bid
        self.deadline = deadline

    @public
    def bid(self, sig: Sig, bidder: PubKey, bid_amount: Bigint):
        """Submit a new bid that outbids the current highest.

        State-mutating: the compiler auto-injects \`\`checkPreimage\`\` at entry and
        appends a state-continuation output at exit, creating a new UTXO with
        the updated \`\`highest_bidder\`\` and \`\`highest_bid\`\`.

        Args:
            sig: Bidder's signature proving they authorized this bid.
            bidder: Public key of the new bidder.
            bid_amount: Bid in satoshis; must exceed the current highest bid.
        """
        # Verify the bidder authorized this bid (prevents griefing)
        assert_(check_sig(sig, bidder))
        # Reject bids that do not exceed the current highest
        assert_(bid_amount > self.highest_bid)
        # Enforce that the auction is still open: nLockTime must be before deadline
        assert_(extract_locktime(self.tx_preimage) < self.deadline)
        # Persist new leader into on-chain state
        self.highest_bidder = bidder
        self.highest_bid = bid_amount

    @public
    def close(self, sig: Sig):
        """Close the auction after the deadline has passed.

        Non-mutating: the compiler auto-injects \`\`checkPreimage\`\` but does NOT
        append a state-continuation output, so the UTXO is fully spent (no
        successor). Only the auctioneer may call this.

        Args:
            sig: Signature from the auctioneer proving ownership.
        """
        # Verify the caller is the auctioneer
        assert_(check_sig(sig, self.auctioneer))
        # Enforce that the deadline has passed: nLockTime must be >= deadline
        assert_(extract_locktime(self.tx_preimage) >= self.deadline)
`,
    constructorArgs: {
      auctioneer: ALICE.pubKey,
      highestBidder: BOB.pubKey,
      highestBid: 0n,
      deadline: 500000n,
    },
    methodCall: {
      method: 'close',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'On-chain English auction with block-height deadline. Auctioneer closes after deadline.',
  },
  {
    id: 'zig-auction',
    name: 'Auction (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const Auction = struct {
    pub const Contract = runar.StatefulSmartContract;

    auctioneer: runar.PubKey,
    highestBidder: runar.PubKey = "000000000000000000000000000000000000000000000000000000000000000000",
    highestBid: i64 = 0,
    deadline: i64,

    pub fn init(
        auctioneer: runar.PubKey,
        highestBidder: runar.PubKey,
        highestBid: i64,
        deadline: i64,
    ) Auction {
        return .{
            .auctioneer = auctioneer,
            .highestBidder = highestBidder,
            .highestBid = highestBid,
            .deadline = deadline,
        };
    }

    pub fn bid(self: *Auction, ctx: runar.StatefulContext, sig: runar.Sig, bidder: runar.PubKey, bidAmount: i64) void {
        runar.assert(runar.checkSig(sig, bidder));
        runar.assert(bidAmount > self.highestBid);
        runar.assert(runar.extractLocktime(ctx.txPreimage) < self.deadline);
        self.highestBidder = bidder;
        self.highestBid = bidAmount;
    }

    pub fn close(self: *const Auction, ctx: runar.StatefulContext, sig: runar.Sig) void {
        runar.assert(runar.checkSig(sig, self.auctioneer));
        runar.assert(runar.extractLocktime(ctx.txPreimage) >= self.deadline);
    }
};
`,
    constructorArgs: {
      auctioneer: ALICE.pubKey,
      highestBidder: BOB.pubKey,
      highestBid: 0n,
      deadline: 500000n,
    },
    methodCall: {
      method: 'close',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'On-chain English auction with block-height deadline. Auctioneer closes after deadline.',
  },
  {
    id: 'ruby-auction',
    name: 'Auction (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class Auction < Runar::StatefulSmartContract
  prop :auctioneer, PubKey, readonly: true
  prop :highest_bidder, PubKey
  prop :highest_bid, Bigint
  prop :deadline, Bigint, readonly: true

  def initialize(auctioneer, highest_bidder, highest_bid, deadline)
    super(auctioneer, highest_bidder, highest_bid, deadline)
    @auctioneer = auctioneer
    @highest_bidder = highest_bidder
    @highest_bid = highest_bid
    @deadline = deadline
  end

  runar_public sig: Sig, bidder: PubKey, bid_amount: Bigint
  def bid(sig, bidder, bid_amount)
    assert check_sig(sig, bidder)
    assert bid_amount > @highest_bid
    assert extract_locktime(@tx_preimage) < @deadline
    @highest_bidder = bidder
    @highest_bid = bid_amount
  end

  runar_public sig: Sig
  def close(sig)
    assert check_sig(sig, @auctioneer)
    assert extract_locktime(@tx_preimage) >= @deadline
  end
end
`,
    constructorArgs: {
      auctioneer: ALICE.pubKey,
      highestBidder: BOB.pubKey,
      highestBid: 0n,
      deadline: 500000n,
    },
    methodCall: {
      method: 'close',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'On-chain English auction with block-height deadline. Auctioneer closes after deadline.',
  },
  {
    id: 'sol-token-nft',
    name: 'Simple NFT (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title SimpleNFT
/// @notice A non-fungible token (NFT) represented as a single UTXO.
/// Unlike fungible tokens, an NFT is indivisible -- the token IS the UTXO. This contract
/// demonstrates ownership transfer and burn (permanent destruction) of a unique digital asset,
/// enforced entirely by Bitcoin Script.
/// @dev UTXO as NFT:
/// Each NFT is a single UTXO carrying:
///   - owner (mutable): current owner's public key, updated on transfer
///   - tokenId (readonly): unique identifier baked into the locking script
///   - metadata (readonly): content hash or URI, also baked in and immutable
///
/// Operations:
///   transfer -- Changes ownership. Creates one continuation UTXO via addOutput.
///   burn     -- Destroys the token permanently. No addOutput = no successor = token ceases to exist.
///
/// Authorization: Both operations require the current owner's ECDSA signature via checkSig.
contract SimpleNFT is StatefulSmartContract {
    PubKey owner;                    /// @notice Current owner's public key. Mutable -- updated when the NFT is transferred.
    ByteString immutable tokenId;    /// @notice Unique token identifier. Readonly -- baked into the locking script at deploy time.
    ByteString immutable metadata;   /// @notice Token metadata (content hash or URI). Readonly -- immutable for the token's lifetime.

    constructor(PubKey _owner, ByteString _tokenId, ByteString _metadata) {
        owner = _owner;
        tokenId = _tokenId;
        metadata = _metadata;
    }

    /// @notice Transfer ownership of the NFT to a new owner.
    /// @dev Creates one continuation UTXO via addOutput with the new owner. tokenId and
    /// metadata remain unchanged (readonly properties are baked into the locking script).
    /// addOutput(satoshis, owner) takes the single mutable property positionally.
    /// @param sig Current owner's signature (authorization)
    /// @param newOwner New owner's public key
    /// @param outputSatoshis Satoshis to fund the continuation UTXO
    function transfer(Sig sig, PubKey newOwner, bigint outputSatoshis) public {
        require(checkSig(sig, this.owner));
        require(outputSatoshis >= 1);
        this.addOutput(outputSatoshis, newOwner);
    }

    /// @notice Burn (permanently destroy) the NFT.
    /// @dev The owner signs to authorize destruction. Because this method does not call addOutput
    /// and does not mutate state, the compiler generates no state continuation. The UTXO is
    /// simply spent with no successor -- the token ceases to exist on-chain.
    /// @param sig Current owner's signature (authorization)
    function burn(Sig sig) public {
        require(checkSig(sig, this.owner));
        // No addOutput and no state mutation = token destroyed
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      tokenId: 'deadbeef01',
      metadata: 'cafe0123456789',
    },
    methodCall: {
      method: 'burn',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Non-fungible token as a UTXO. Transfer changes ownership; burn destroys the token.',
  },
  {
    id: 'move-token-nft',
    name: 'Simple NFT (Move)',
    language: 'move',
    source: `// SimpleNFT -- A non-fungible token (NFT) represented as a single UTXO.
//
// Unlike fungible tokens, an NFT is indivisible -- the token IS the UTXO. This contract
// demonstrates ownership transfer and burn (permanent destruction) of a unique digital asset,
// enforced entirely by Bitcoin Script.
//
// UTXO as NFT:
// Each NFT is a single UTXO carrying:
//   - owner (mutable): current owner's public key, updated on transfer
//   - token_id (readonly): unique identifier baked into the locking script
//   - metadata (readonly): content hash or URI, also baked in and immutable
//
// Operations:
//   transfer -- Changes ownership. Creates one continuation UTXO via add_output.
//   burn     -- Destroys the token permanently. No add_output = no successor = token ceases to exist.
//
// Authorization: Both operations require the current owner's ECDSA signature via check_sig.
module SimpleNFT {
    use runar::types::{PubKey, Sig, ByteString};
    use runar::crypto::{check_sig};

    resource struct SimpleNFT {
        owner: &mut PubKey,       // Current owner's public key. Mutable -- updated when the NFT is transferred.
        token_id: ByteString,     // Unique token identifier. Immutable -- baked into the locking script at deploy time.
        metadata: ByteString,     // Token metadata (content hash or URI). Immutable for the token's lifetime.
    }

    // Transfer ownership of the NFT to a new owner.
    //
    // Creates one continuation UTXO via add_output with the new owner. token_id and
    // metadata remain unchanged (readonly properties are baked into the locking script).
    // add_output(satoshis, owner) takes the single mutable property positionally.
    //
    // Parameters:
    //   sig: current owner's signature (authorization)
    //   new_owner: new owner's public key
    //   output_satoshis: satoshis to fund the continuation UTXO
    public fun transfer(contract: &mut SimpleNFT, sig: Sig, new_owner: PubKey, output_satoshis: bigint) {
        assert!(check_sig(sig, contract.owner), 0);
        assert!(output_satoshis >= 1, 0);
        contract.add_output(output_satoshis, new_owner);
    }

    // Burn (permanently destroy) the NFT.
    //
    // The owner signs to authorize destruction. Because this method does not call add_output
    // and does not mutate state, the compiler generates no state continuation. The UTXO is
    // simply spent with no successor -- the token ceases to exist on-chain.
    //
    // Parameters:
    //   sig: current owner's signature (authorization)
    public fun burn(contract: &mut SimpleNFT, sig: Sig) {
        assert!(check_sig(sig, contract.owner), 0);
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      tokenId: 'deadbeef01',
      metadata: 'cafe0123456789',
    },
    methodCall: {
      method: 'burn',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Non-fungible token as a UTXO. Transfer changes ownership; burn destroys the token.',
  },
  {
    id: 'go-token-nft',
    name: 'Simple NFT (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// SimpleNFT is a non-fungible token (NFT) represented as a single UTXO.
//
// Unlike fungible tokens, an NFT is indivisible -- the token IS the UTXO. This contract
// demonstrates ownership transfer and burn (permanent destruction) of a unique digital asset,
// enforced entirely by Bitcoin Script.
//
// UTXO as NFT:
// Each NFT is a single UTXO carrying:
//   - Owner (mutable): current owner's public key, updated on transfer
//   - TokenId (readonly): unique identifier baked into the locking script
//   - Metadata (readonly): content hash or URI, also baked in and immutable
//
// Operations:
//   - Transfer -- Changes ownership. Creates one continuation UTXO via AddOutput with a new owner.
//   - Burn     -- Destroys the token permanently. No AddOutput = no continuation UTXO = token ceases to exist.
//
// Authorization: Both operations require the current owner's ECDSA signature via CheckSig.
type SimpleNFT struct {
	runar.StatefulSmartContract
	Owner    runar.PubKey     // Current owner's public key. Mutable -- updated when the NFT is transferred.
	TokenId  runar.ByteString \`runar:"readonly"\` // Unique token identifier. Readonly -- baked into the locking script at deploy time.
	Metadata runar.ByteString \`runar:"readonly"\` // Token metadata (content hash or URI). Readonly -- immutable for the token's lifetime.
}

// Transfer changes ownership of the NFT to a new owner.
//
// Creates one continuation UTXO via AddOutput with the new owner. TokenId and Metadata
// remain unchanged (readonly properties are baked into the locking script).
// AddOutput(satoshis, owner) takes the single mutable property positionally.
//
// Parameters:
//   - sig: current owner's signature (authorization)
//   - newOwner: new owner's public key
//   - outputSatoshis: satoshis to fund the continuation UTXO
func (c *SimpleNFT) Transfer(sig runar.Sig, newOwner runar.PubKey, outputSatoshis runar.Bigint) {
	runar.Assert(runar.CheckSig(sig, c.Owner))
	runar.Assert(outputSatoshis >= 1)
	c.AddOutput(outputSatoshis, newOwner)
}

// Burn permanently destroys the NFT.
//
// The owner signs to authorize destruction. Because this method does not call AddOutput
// and does not mutate state, the compiler generates no state continuation. The UTXO is
// simply spent with no successor -- the token ceases to exist on-chain.
//
// Parameters:
//   - sig: current owner's signature (authorization)
func (c *SimpleNFT) Burn(sig runar.Sig) {
	runar.Assert(runar.CheckSig(sig, c.Owner))
	// No AddOutput and no state mutation = token destroyed
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      tokenId: 'deadbeef01',
      metadata: 'cafe0123456789',
    },
    methodCall: {
      method: 'burn',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Non-fungible token as a UTXO. Transfer changes ownership; burn destroys the token.',
  },
  {
    id: 'rust-token-nft',
    name: 'Simple NFT (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// A non-fungible token (NFT) represented as a single UTXO.
///
/// Unlike fungible tokens, an NFT is indivisible -- the token IS the UTXO. This contract
/// demonstrates ownership transfer and burn (permanent destruction) of a unique digital asset,
/// enforced entirely by Bitcoin Script.
///
/// # UTXO as NFT
///
/// Each NFT is a single UTXO carrying:
/// - \`owner\` (mutable): current owner's public key, updated on transfer
/// - \`token_id\` (readonly): unique identifier baked into the locking script
/// - \`metadata\` (readonly): content hash or URI, also baked in and immutable
///
/// # Operations
///
/// - \`transfer\` -- Changes ownership. Creates one continuation UTXO via \`add_output\`.
/// - \`burn\`     -- Destroys the token permanently. No \`add_output\` = no successor = token ceases to exist.
///
/// # Authorization
///
/// Both operations require the current owner's ECDSA signature via \`check_sig\`.
#[runar::contract]
pub struct SimpleNFT {
    /// Current owner's public key. Mutable -- updated when the NFT is transferred.
    pub owner: PubKey,
    /// Unique token identifier. Readonly -- baked into the locking script at deploy time.
    #[readonly]
    pub token_id: ByteString,
    /// Token metadata (content hash or URI). Readonly -- immutable for the token's lifetime.
    #[readonly]
    pub metadata: ByteString,
}

#[runar::methods(SimpleNFT)]
impl SimpleNFT {
    /// Transfer ownership of the NFT to a new owner.
    ///
    /// Creates one continuation UTXO via \`add_output\` with the new owner. \`token_id\` and
    /// \`metadata\` remain unchanged (readonly properties are baked into the locking script).
    /// \`add_output(satoshis, owner)\` takes the single mutable property positionally.
    ///
    /// # Parameters
    /// - \`sig\` - Current owner's signature (authorization)
    /// - \`new_owner\` - New owner's public key
    /// - \`output_satoshis\` - Satoshis to fund the continuation UTXO
    #[public]
    pub fn transfer(&mut self, sig: &Sig, new_owner: PubKey, output_satoshis: Bigint) {
        assert!(check_sig(sig, &self.owner));
        assert!(output_satoshis >= 1);
        self.add_output(output_satoshis, new_owner);
    }

    /// Burn (permanently destroy) the NFT.
    ///
    /// The owner signs to authorize destruction. Because this method does not call \`add_output\`
    /// and does not mutate state, the compiler generates no state continuation. The UTXO is
    /// simply spent with no successor -- the token ceases to exist on-chain.
    ///
    /// # Parameters
    /// - \`sig\` - Current owner's signature (authorization)
    #[public]
    pub fn burn(&self, sig: &Sig) {
        assert!(check_sig(sig, &self.owner));
        // No add_output = token destroyed
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      tokenId: 'deadbeef01',
      metadata: 'cafe0123456789',
    },
    methodCall: {
      method: 'burn',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Non-fungible token as a UTXO. Transfer changes ownership; burn destroys the token.',
  },
  {
    id: 'python-token-nft',
    name: 'Simple NFT (Python)',
    language: 'python',
    source: `from runar import (
    StatefulSmartContract, PubKey, Sig, ByteString, Bigint, Readonly,
    public, assert_, check_sig,
)


class SimpleNFT(StatefulSmartContract):
    """A non-fungible token (NFT) represented as a single UTXO.

    Unlike fungible tokens, an NFT is indivisible -- the token IS the UTXO. This contract
    demonstrates ownership transfer and burn (permanent destruction) of a unique digital asset,
    enforced entirely by Bitcoin Script.

    UTXO as NFT:
        Each NFT is a single UTXO carrying:
        - owner (mutable): current owner's public key, updated on transfer
        - token_id (readonly): unique identifier baked into the locking script
        - metadata (readonly): content hash or URI, also baked in and immutable

    Operations:
        transfer -- Changes ownership. Creates one continuation UTXO via add_output.
        burn     -- Destroys the token permanently. No add_output = no successor = token ceases to exist.

    Authorization:
        Both operations require the current owner's ECDSA signature via check_sig.
    """

    owner: PubKey                    # Current owner's public key. Mutable -- updated when the NFT is transferred.
    token_id: Readonly[ByteString]   # Unique token identifier. Readonly -- baked into the locking script at deploy time.
    metadata: Readonly[ByteString]   # Token metadata (content hash or URI). Readonly -- immutable for the token's lifetime.

    def __init__(self, owner: PubKey, token_id: ByteString, metadata: ByteString):
        super().__init__(owner, token_id, metadata)
        self.owner = owner
        self.token_id = token_id
        self.metadata = metadata

    @public
    def transfer(self, sig: Sig, new_owner: PubKey, output_satoshis: Bigint):
        """Transfer ownership of the NFT to a new owner.

        Creates one continuation UTXO via add_output with the new owner. token_id and
        metadata remain unchanged (readonly properties are baked into the locking script).
        add_output(satoshis, owner) takes the single mutable property positionally.

        Args:
            sig: Current owner's signature (authorization).
            new_owner: New owner's public key.
            output_satoshis: Satoshis to fund the continuation UTXO.
        """
        assert_(check_sig(sig, self.owner))
        assert_(output_satoshis >= 1)
        self.add_output(output_satoshis, new_owner)

    @public
    def burn(self, sig: Sig):
        """Burn (permanently destroy) the NFT.

        The owner signs to authorize destruction. Because this method does not call add_output
        and does not mutate state, the compiler generates no state continuation. The UTXO is
        simply spent with no successor -- the token ceases to exist on-chain.

        Args:
            sig: Current owner's signature (authorization).
        """
        assert_(check_sig(sig, self.owner))
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      tokenId: 'deadbeef01',
      metadata: 'cafe0123456789',
    },
    methodCall: {
      method: 'burn',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Non-fungible token as a UTXO. Transfer changes ownership; burn destroys the token.',
  },
  {
    id: 'zig-token-nft',
    name: 'Simple NFT (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const NFTExample = struct {
    pub const Contract = runar.StatefulSmartContract;

    owner: runar.PubKey = "000000000000000000000000000000000000000000000000000000000000000000",
    tokenId: runar.ByteString,
    metadata: runar.ByteString,

    pub fn init(owner: runar.PubKey, tokenId: runar.ByteString, metadata: runar.ByteString) NFTExample {
        return .{
            .owner = owner,
            .tokenId = tokenId,
            .metadata = metadata,
        };
    }

    pub fn transfer(self: *NFTExample, ctx: runar.StatefulContext, sig: runar.Sig, newOwner: runar.PubKey, outputSatoshis: i64) void {
        runar.assert(runar.checkSig(sig, self.owner));
        runar.assert(outputSatoshis >= 1);
        ctx.addOutput(outputSatoshis, .{ newOwner });
    }

    pub fn burn(self: *const NFTExample, sig: runar.Sig) void {
        runar.assert(runar.checkSig(sig, self.owner));
    }
};
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      tokenId: 'deadbeef01',
      metadata: 'cafe0123456789',
    },
    methodCall: {
      method: 'burn',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Non-fungible token as a UTXO. Transfer changes ownership; burn destroys the token.',
  },
  {
    id: 'ruby-token-nft',
    name: 'Simple NFT (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class SimpleNFT < Runar::StatefulSmartContract
  prop :owner, PubKey
  prop :token_id, ByteString, readonly: true
  prop :metadata, ByteString, readonly: true

  def initialize(owner, token_id, metadata)
    super(owner, token_id, metadata)
    @owner = owner
    @token_id = token_id
    @metadata = metadata
  end

  runar_public sig: Sig, new_owner: PubKey, output_satoshis: Bigint
  def transfer(sig, new_owner, output_satoshis)
    assert check_sig(sig, @owner)
    assert output_satoshis >= 1
    add_output(output_satoshis, new_owner)
  end

  runar_public sig: Sig
  def burn(sig)
    assert check_sig(sig, @owner)
  end
end
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      tokenId: 'deadbeef01',
      metadata: 'cafe0123456789',
    },
    methodCall: {
      method: 'burn',
      args: [
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Non-fungible token as a UTXO. Transfer changes ownership; burn destroys the token.',
  },
  {
    id: 'sol-property-initializers',
    name: 'Bounded Counter (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title BoundedCounter
/// @notice Demonstrates property initializers in Solidity-like format.
///
/// Properties with \`= value\` defaults are excluded from the auto-generated
/// constructor. Only \`maxCount\` needs to be provided at deploy time.
contract BoundedCounter is StatefulSmartContract {
    int256 count = 0;
    int256 immutable maxCount;
    bool immutable active = true;

    function increment(int256 amount) public {
        require(this.active);
        this.count = this.count + amount;
        require(this.count <= this.maxCount);
    }

    function reset() public {
        this.count = 0;
    }
}
`,
    constructorArgs: {
      maxCount: 100n,
    },
    methodCall: {
      method: 'increment',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Counter with maximum bound and property initializers. count starts at 0, active starts true.',
  },
  {
    id: 'move-property-initializers',
    name: 'Bounded Counter (Move)',
    language: 'move',
    source: `// BoundedCounter — demonstrates property initializers in Move-like format.
//
// Properties with \`= value\` defaults are excluded from the auto-generated
// constructor. Only \`max_count\` needs to be provided at deploy time.
module BoundedCounter {
    use runar::StatefulSmartContract;

    resource struct BoundedCounter {
        count: &mut bigint = 0,
        max_count: bigint,
        active: Bool = true,
    }

    public fun increment(amount: bigint) {
        assert!(self.active);
        self.count = self.count + amount;
        assert!(self.count <= self.max_count);
    }

    public fun reset() {
        self.count = 0;
    }
}
`,
    constructorArgs: {
      maxCount: 100n,
    },
    methodCall: {
      method: 'increment',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Counter with maximum bound and property initializers. count starts at 0, active starts true.',
  },
  {
    id: 'go-property-initializers',
    name: 'Bounded Counter (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// BoundedCounter demonstrates property initializers in Go format.
//
// Properties assigned in the init() method are excluded from the auto-generated
// constructor. Only MaxCount needs to be provided at deploy time.
type BoundedCounter struct {
	runar.StatefulSmartContract
	Count    runar.Bigint
	MaxCount runar.Bigint \`runar:"readonly"\`
	Active   runar.Bool   \`runar:"readonly"\`
}

func (c *BoundedCounter) init() {
	c.Count = 0
	c.Active = true
}

func (c *BoundedCounter) Increment(amount runar.Bigint) {
	runar.Assert(c.Active)
	c.Count = c.Count + amount
	runar.Assert(c.Count <= c.MaxCount)
}

func (c *BoundedCounter) Reset() {
	c.Count = 0
}
`,
    constructorArgs: {
      maxCount: 100n,
    },
    methodCall: {
      method: 'increment',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Counter with maximum bound and property initializers. count starts at 0, active starts true.',
  },
  {
    id: 'rust-property-initializers',
    name: 'Bounded Counter (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// BoundedCounter — demonstrates property initializers in Rust format.
///
/// Properties assigned in the \`init()\` method are excluded from the
/// auto-generated constructor. Only \`max_count\` needs to be provided
/// at deploy time.
#[runar::contract]
pub struct BoundedCounter {
    pub count: Bigint,
    #[readonly]
    pub max_count: Bigint,
    #[readonly]
    pub active: bool,
}

#[runar::methods(BoundedCounter)]
impl BoundedCounter {
    pub fn init(&mut self) {
        self.count = 0;
        self.active = true;
    }

    #[public]
    pub fn increment(&mut self, amount: Bigint) {
        assert!(self.active);
        self.count = self.count + amount;
        assert!(self.count <= self.max_count);
    }

    #[public]
    pub fn reset(&mut self) {
        self.count = 0;
    }
}
`,
    constructorArgs: {
      maxCount: 100n,
    },
    methodCall: {
      method: 'increment',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Counter with maximum bound and property initializers. count starts at 0, active starts true.',
  },
  {
    id: 'python-property-initializers',
    name: 'Bounded Counter (Python)',
    language: 'python',
    source: `from runar import StatefulSmartContract, Bigint, Readonly, public, assert_


class BoundedCounter(StatefulSmartContract):
    """BoundedCounter -- demonstrates property initializers in Python format.

    Properties with \`= value\` defaults are excluded from the auto-generated
    constructor. Only \`max_count\` needs to be provided at deploy time.
    """

    count: Bigint = 0
    max_count: Readonly[Bigint]
    active: Readonly[bool] = True

    def __init__(self, max_count: Bigint):
        super().__init__(max_count)
        self.max_count = max_count

    @public
    def increment(self, amount: Bigint):
        assert_(self.active)
        self.count = self.count + amount
        assert_(self.count <= self.max_count)

    @public
    def reset(self):
        self.count = 0
`,
    constructorArgs: {
      maxCount: 100n,
    },
    methodCall: {
      method: 'increment',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Counter with maximum bound and property initializers. count starts at 0, active starts true.',
  },
  {
    id: 'zig-property-initializers',
    name: 'Bounded Counter (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const BoundedCounter = struct {
    pub const Contract = runar.StatefulSmartContract;

    count: i64 = 0,
    maxCount: i64,
    active: runar.Readonly(bool) = true,

    pub fn init(maxCount: i64) BoundedCounter {
        return .{
            .maxCount = maxCount,
        };
    }

    pub fn increment(self: *BoundedCounter, amount: i64) void {
        runar.assert(self.active);
        self.count = self.count + amount;
        runar.assert(self.count <= self.maxCount);
    }

    pub fn reset(self: *BoundedCounter) void {
        self.count = 0;
    }
};
`,
    constructorArgs: {
      maxCount: 100n,
    },
    methodCall: {
      method: 'increment',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Counter with maximum bound and property initializers. count starts at 0, active starts true.',
  },
  {
    id: 'ruby-property-initializers',
    name: 'Bounded Counter (Ruby)',
    language: 'ruby',
    source: `require 'runar'

# BoundedCounter -- demonstrates property initializers in Ruby format.
#
# Properties with a \`default:\` option are excluded from the auto-generated
# constructor, simplifying deployment. Only \`max_count\` needs to be provided
# at deploy time; \`count\` starts at 0 and \`active\` starts as true automatically.

class BoundedCounter < Runar::StatefulSmartContract
  prop :count,     Bigint,  default: 0
  prop :max_count, Bigint,  readonly: true
  prop :active,    Boolean, readonly: true, default: true

  def initialize(max_count)
    super(max_count)
    @max_count = max_count
  end

  runar_public amount: Bigint
  def increment(amount)
    assert @active
    @count = @count + amount
    assert @count <= @max_count
  end

  runar_public
  def reset
    @count = 0
  end
end
`,
    constructorArgs: {
      maxCount: 100n,
    },
    methodCall: {
      method: 'increment',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Counter with maximum bound and property initializers. count starts at 0, active starts true.',
  },
  {
    id: 'sol-oracle-price',
    name: 'Oracle Price Feed (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title OraclePriceFeed
/// @notice A stateless oracle contract for price-triggered payouts.
/// @dev Demonstrates the "oracle pattern" where off-chain data (e.g., asset prices)
/// is cryptographically signed by a trusted oracle and verified on-chain using
/// Rabin signatures. Rabin signatures are well-suited for Bitcoin Script because
/// verification requires only modular multiplication and comparison — operations
/// that are cheap in Script.
///
/// The contract enforces three verification layers:
///   1. Oracle verification — the price was genuinely signed by the trusted oracle's Rabin key
///   2. Price threshold — the price must exceed 50,000 (application-specific business logic)
///   3. Receiver authorization — the receiver must provide a valid ECDSA signature
///
/// Use cases: derivatives/futures settlement, price-triggered payouts, conditional
/// escrow based on market data, insurance contracts.
///
/// Contract model: Stateless (SmartContract). The oracle's Rabin public key and the
/// receiver's ECDSA public key are immutable constructor parameters.
contract OraclePriceFeed is SmartContract {
    /// @notice Rabin public key of the trusted oracle (a large integer modulus, typically 128+ bytes).
    RabinPubKey immutable oraclePubKey;
    /// @notice ECDSA compressed public key (33 bytes) of the authorized payout receiver.
    PubKey immutable receiver;

    constructor(RabinPubKey _oraclePubKey, PubKey _receiver) {
        oraclePubKey = _oraclePubKey;
        receiver = _receiver;
    }

    /// @notice Settle the contract by proving a price was signed by the oracle and exceeds
    /// the threshold. The receiver must also sign to authorize the payout.
    /// @param price The oracle-attested price value (integer).
    /// @param rabinSig Rabin signature produced by the oracle over the price (variable length).
    /// @param padding Rabin signature padding bytes required for verification (variable length).
    /// @param sig ECDSA signature (~72 bytes) from the receiver authorizing the spend.
    function settle(bigint price, RabinSig rabinSig, ByteString padding, Sig sig) public {
        // Layer 1: Oracle verification — convert the price to its 8-byte little-endian
        // canonical form (the format the oracle signs), then verify the Rabin signature
        // against the oracle's public key using modular arithmetic.
        let ByteString msg = num2bin(price, 8);
        require(verifyRabinSig(msg, rabinSig, padding, this.oraclePubKey));

        // Layer 2: Price threshold — application-specific business logic requiring
        // the oracle-attested price to exceed 50,000 before the payout is allowed.
        require(price > 50000);

        // Layer 3: Receiver authorization — the designated receiver must provide a
        // valid ECDSA signature to claim the payout, preventing front-running.
        require(checkSig(sig, this.receiver));
    }
}
`,
    constructorArgs: {
      oraclePubKey: 1852673427797059126777135760139020137744618460251467317973768694675137031965589n,
      receiver: ALICE.pubKey,
    },
    methodCall: {
      method: 'settle',
      args: [
        { type: 'bigint', value: '60000' },
        { type: 'bigint', value: '195594275932023152769541819028047709452880413796780214800172974889079016519477' },
        { type: 'ByteString', value: '04' },
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Oracle-verified price feed with Rabin signature. Price must exceed 50,000 threshold.',
  },
  {
    id: 'move-oracle-price',
    name: 'Oracle Price Feed (Move)',
    language: 'move',
    source: `// OraclePriceFeed — A stateless oracle contract for price-triggered payouts.
//
// Demonstrates the "oracle pattern" where off-chain data (e.g., asset prices)
// is cryptographically signed by a trusted oracle and verified on-chain using
// Rabin signatures. Rabin signatures are well-suited for Bitcoin Script because
// verification requires only modular multiplication and comparison — operations
// that are cheap in Script.
//
// The contract enforces three verification layers:
//   1. Oracle verification — the price was genuinely signed by the trusted oracle's Rabin key
//   2. Price threshold — the price must exceed 50,000 (application-specific business logic)
//   3. Receiver authorization — the receiver must provide a valid ECDSA signature
//
// Use cases: derivatives/futures settlement, price-triggered payouts, conditional
// escrow based on market data, insurance contracts.
//
// Contract model: Stateless (SmartContract). The oracle's Rabin public key and the
// receiver's ECDSA public key are immutable constructor parameters.
module OraclePriceFeed {
    use runar::types::{PubKey, Sig, ByteString, RabinSig, RabinPubKey};
    use runar::crypto::{check_sig, verify_rabin_sig, num2bin};

    resource struct OraclePriceFeed {
        // Rabin public key of the trusted oracle (a large integer modulus, typically 128+ bytes).
        oracle_pub_key: RabinPubKey,
        // ECDSA compressed public key (33 bytes) of the authorized payout receiver.
        receiver: PubKey,
    }

    // Settle the contract by proving a price was signed by the oracle and exceeds
    // the threshold. The receiver must also sign to authorize the payout.
    //
    // Parameters:
    //   price     - The oracle-attested price value (integer).
    //   rabin_sig - Rabin signature produced by the oracle over the price (variable length).
    //   padding   - Rabin signature padding bytes required for verification (variable length).
    //   sig       - ECDSA signature (~72 bytes) from the receiver authorizing the spend.
    public fun settle(contract: &OraclePriceFeed, price: bigint, rabin_sig: RabinSig, padding: ByteString, sig: Sig) {
        // Layer 1: Oracle verification — convert the price to its 8-byte little-endian
        // canonical form (the format the oracle signs), then verify the Rabin signature
        // against the oracle's public key using modular arithmetic.
        let msg = num2bin(price, 8);
        assert!(verify_rabin_sig(msg, rabin_sig, padding, contract.oracle_pub_key), 0);

        // Layer 2: Price threshold — application-specific business logic requiring
        // the oracle-attested price to exceed 50,000 before the payout is allowed.
        assert!(price > 50000, 0);

        // Layer 3: Receiver authorization — the designated receiver must provide a
        // valid ECDSA signature to claim the payout, preventing front-running.
        assert!(check_sig(sig, contract.receiver), 0);
    }
}
`,
    constructorArgs: {
      oraclePubKey: 1852673427797059126777135760139020137744618460251467317973768694675137031965589n,
      receiver: ALICE.pubKey,
    },
    methodCall: {
      method: 'settle',
      args: [
        { type: 'bigint', value: '60000' },
        { type: 'bigint', value: '195594275932023152769541819028047709452880413796780214800172974889079016519477' },
        { type: 'ByteString', value: '04' },
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Oracle-verified price feed with Rabin signature. Price must exceed 50,000 threshold.',
  },
  {
    id: 'go-oracle-price',
    name: 'Oracle Price Feed (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// OraclePriceFeed is a stateless oracle contract for price-triggered payouts.
//
// It demonstrates the "oracle pattern" where off-chain data (e.g., asset prices)
// is cryptographically signed by a trusted oracle and verified on-chain using
// Rabin signatures. Rabin signatures are well-suited for Bitcoin Script because
// verification requires only modular multiplication and comparison — operations
// that are cheap in Script.
//
// The contract enforces three verification layers:
//   1. Oracle verification — the price was genuinely signed by the trusted oracle's Rabin key
//   2. Price threshold — the price must exceed 50,000 (application-specific business logic)
//   3. Receiver authorization — the receiver must provide a valid ECDSA signature to claim the payout
//
// Use cases: derivatives/futures settlement, price-triggered payouts, conditional
// escrow based on market data, insurance contracts.
//
// Contract model: Stateless (SmartContract). The oracle's Rabin public key and the
// receiver's ECDSA public key are immutable constructor parameters.
type OraclePriceFeed struct {
	runar.SmartContract
	// OraclePubKey is the Rabin public key of the trusted oracle (a large integer
	// modulus, typically 128+ bytes).
	OraclePubKey runar.RabinPubKey \`runar:"readonly"\`
	// Receiver is the ECDSA compressed public key (33 bytes) of the authorized
	// payout receiver.
	Receiver runar.PubKey \`runar:"readonly"\`
}

// Settle verifies that an oracle-attested price exceeds the threshold and that
// the receiver authorizes the spend.
//
// Parameters:
//   - price:    the oracle-attested price value (integer)
//   - rabinSig: Rabin signature produced by the oracle over the price (variable length)
//   - padding:  Rabin signature padding bytes required for verification (variable length)
//   - sig:      ECDSA signature (~72 bytes) from the receiver authorizing the spend
func (c *OraclePriceFeed) Settle(price runar.Bigint, rabinSig runar.RabinSig, padding runar.ByteString, sig runar.Sig) {
	// Layer 1: Oracle verification — convert the price to its 8-byte little-endian
	// canonical form (the format the oracle signs), then verify the Rabin signature
	// against the oracle's public key using modular arithmetic.
	msg := runar.Num2Bin(price, 8)

	runar.Assert(runar.VerifyRabinSig(msg, rabinSig, padding, c.OraclePubKey))

	// Layer 2: Price threshold — application-specific business logic requiring
	// the oracle-attested price to exceed 50,000 before the payout is allowed.
	runar.Assert(price > 50000)

	// Layer 3: Receiver authorization — the designated receiver must provide a
	// valid ECDSA signature to claim the payout, preventing front-running.
	runar.Assert(runar.CheckSig(sig, c.Receiver))
}
`,
    constructorArgs: {
      oraclePubKey: 1852673427797059126777135760139020137744618460251467317973768694675137031965589n,
      receiver: ALICE.pubKey,
    },
    methodCall: {
      method: 'settle',
      args: [
        { type: 'bigint', value: '60000' },
        { type: 'bigint', value: '195594275932023152769541819028047709452880413796780214800172974889079016519477' },
        { type: 'ByteString', value: '04' },
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Oracle-verified price feed with Rabin signature. Price must exceed 50,000 threshold.',
  },
  {
    id: 'rust-oracle-price',
    name: 'Oracle Price Feed (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// OraclePriceFeed — A stateless oracle contract for price-triggered payouts.
///
/// Demonstrates the "oracle pattern" where off-chain data (e.g., asset prices)
/// is cryptographically signed by a trusted oracle and verified on-chain using
/// Rabin signatures. Rabin signatures are well-suited for Bitcoin Script because
/// verification requires only modular multiplication and comparison — operations
/// that are cheap in Script.
///
/// The contract enforces three verification layers:
///   1. Oracle verification — the price was genuinely signed by the trusted oracle's Rabin key
///   2. Price threshold — the price must exceed 50,000 (application-specific business logic)
///   3. Receiver authorization — the receiver must provide a valid ECDSA signature to claim the payout
///
/// Use cases: derivatives/futures settlement, price-triggered payouts, conditional
/// escrow based on market data, insurance contracts.
///
/// Contract model: Stateless (SmartContract). The oracle's Rabin public key and the
/// receiver's ECDSA public key are immutable constructor parameters.
#[runar::contract]
pub struct OraclePriceFeed {
    /// Rabin public key of the trusted oracle (a large integer modulus, typically 128+ bytes).
    #[readonly]
    pub oracle_pub_key: RabinPubKey,
    /// ECDSA compressed public key (33 bytes) of the authorized payout receiver.
    #[readonly]
    pub receiver: PubKey,
}

#[runar::methods(OraclePriceFeed)]
impl OraclePriceFeed {
    /// Settle the contract by proving a price was signed by the oracle and exceeds
    /// the threshold. The receiver must also sign to authorize the payout.
    ///
    /// # Arguments
    /// * \`price\` - The oracle-attested price value (integer).
    /// * \`rabin_sig\` - Rabin signature produced by the oracle over the price (variable length).
    /// * \`padding\` - Rabin signature padding bytes required for verification (variable length).
    /// * \`sig\` - ECDSA signature (~72 bytes) from the receiver authorizing the spend.
    #[public]
    pub fn settle(&self, price: Bigint, rabin_sig: &RabinSig, padding: &ByteString, sig: &Sig) {
        // Layer 1: Oracle verification — convert the price to its 8-byte little-endian
        // canonical form (the format the oracle signs), then verify the Rabin signature
        // against the oracle's public key using modular arithmetic.
        let msg = num2bin(&price, 8);
        assert!(verify_rabin_sig(&msg, rabin_sig, padding, &self.oracle_pub_key));
        // Layer 2: Price threshold — application-specific business logic requiring
        // the oracle-attested price to exceed 50,000 before the payout is allowed.
        assert!(price > 50000);
        // Layer 3: Receiver authorization — the designated receiver must provide a
        // valid ECDSA signature to claim the payout, preventing front-running.
        assert!(check_sig(sig, &self.receiver));
    }
}
`,
    constructorArgs: {
      oraclePubKey: 1852673427797059126777135760139020137744618460251467317973768694675137031965589n,
      receiver: ALICE.pubKey,
    },
    methodCall: {
      method: 'settle',
      args: [
        { type: 'bigint', value: '60000' },
        { type: 'bigint', value: '195594275932023152769541819028047709452880413796780214800172974889079016519477' },
        { type: 'ByteString', value: '04' },
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Oracle-verified price feed with Rabin signature. Price must exceed 50,000 threshold.',
  },
  {
    id: 'python-oracle-price',
    name: 'Oracle Price Feed (Python)',
    language: 'python',
    source: `from runar import (
    SmartContract, PubKey, Sig, ByteString, RabinSig, RabinPubKey, Bigint,
    public, assert_, check_sig, verify_rabin_sig, num2bin,
)


class OraclePriceFeed(SmartContract):
    """A stateless oracle contract for price-triggered payouts.

    Demonstrates the "oracle pattern" where off-chain data (e.g., asset prices)
    is cryptographically signed by a trusted oracle and verified on-chain using
    Rabin signatures. Rabin signatures are well-suited for Bitcoin Script because
    verification requires only modular multiplication and comparison -- operations
    that are cheap in Script.

    The contract enforces three verification layers:
        1. Oracle verification -- the price was genuinely signed by the trusted oracle's Rabin key
        2. Price threshold -- the price must exceed 50,000 (application-specific business logic)
        3. Receiver authorization -- the receiver must provide a valid ECDSA signature

    Use cases: derivatives/futures settlement, price-triggered payouts, conditional
    escrow based on market data, insurance contracts.

    Contract model: Stateless (SmartContract). The oracle's Rabin public key and the
    receiver's ECDSA public key are immutable constructor parameters.

    Attributes:
        oracle_pub_key: Rabin public key of the trusted oracle (a large integer
            modulus, typically 128+ bytes).
        receiver: ECDSA compressed public key (33 bytes) of the authorized
            payout receiver.
    """

    oracle_pub_key: RabinPubKey
    receiver: PubKey

    def __init__(self, oracle_pub_key: RabinPubKey, receiver: PubKey):
        super().__init__(oracle_pub_key, receiver)
        self.oracle_pub_key = oracle_pub_key
        self.receiver = receiver

    @public
    def settle(self, price: Bigint, rabin_sig: RabinSig, padding: ByteString, sig: Sig):
        """Settle the contract by proving a price was signed by the oracle and exceeds
        the threshold. The receiver must also sign to authorize the payout.

        Args:
            price: The oracle-attested price value (integer).
            rabin_sig: Rabin signature produced by the oracle over the price (variable length).
            padding: Rabin signature padding bytes required for verification (variable length).
            sig: ECDSA signature (~72 bytes) from the receiver authorizing the spend.
        """
        # Layer 1: Oracle verification -- convert the price to its 8-byte little-endian
        # canonical form (the format the oracle signs), then verify the Rabin signature
        # against the oracle's public key using modular arithmetic.
        msg = num2bin(price, 8)
        assert_(verify_rabin_sig(msg, rabin_sig, padding, self.oracle_pub_key))
        # Layer 2: Price threshold -- application-specific business logic requiring
        # the oracle-attested price to exceed 50,000 before the payout is allowed.
        assert_(price > 50000)
        # Layer 3: Receiver authorization -- the designated receiver must provide a
        # valid ECDSA signature to claim the payout, preventing front-running.
        assert_(check_sig(sig, self.receiver))
`,
    constructorArgs: {
      oraclePubKey: 1852673427797059126777135760139020137744618460251467317973768694675137031965589n,
      receiver: ALICE.pubKey,
    },
    methodCall: {
      method: 'settle',
      args: [
        { type: 'bigint', value: '60000' },
        { type: 'bigint', value: '195594275932023152769541819028047709452880413796780214800172974889079016519477' },
        { type: 'ByteString', value: '04' },
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Oracle-verified price feed with Rabin signature. Price must exceed 50,000 threshold.',
  },
  {
    id: 'zig-oracle-price',
    name: 'Oracle Price Feed (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const OraclePriceFeed = struct {
    pub const Contract = runar.SmartContract;

    oraclePubKey: runar.RabinPubKey,
    receiver: runar.PubKey,

    pub fn init(oraclePubKey: runar.RabinPubKey, receiver: runar.PubKey) OraclePriceFeed {
        return .{
            .oraclePubKey = oraclePubKey,
            .receiver = receiver,
        };
    }

    pub fn settle(
        self: *const OraclePriceFeed,
        price: i64,
        rabinSig: runar.RabinSig,
        padding: runar.ByteString,
        sig: runar.Sig,
    ) void {
        const msg = runar.num2bin(price, 8);
        runar.assert(runar.verifyRabinSig(msg, rabinSig, padding, self.oraclePubKey));
        runar.assert(price > 50000);
        runar.assert(runar.checkSig(sig, self.receiver));
    }
};
`,
    constructorArgs: {
      oraclePubKey: 1852673427797059126777135760139020137744618460251467317973768694675137031965589n,
      receiver: ALICE.pubKey,
    },
    methodCall: {
      method: 'settle',
      args: [
        { type: 'bigint', value: '60000' },
        { type: 'bigint', value: '195594275932023152769541819028047709452880413796780214800172974889079016519477' },
        { type: 'ByteString', value: '04' },
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Oracle-verified price feed with Rabin signature. Price must exceed 50,000 threshold.',
  },
  {
    id: 'ruby-oracle-price',
    name: 'Oracle Price Feed (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class OraclePriceFeed < Runar::SmartContract
  prop :oracle_pub_key, RabinPubKey
  prop :receiver, PubKey

  def initialize(oracle_pub_key, receiver)
    super(oracle_pub_key, receiver)
    @oracle_pub_key = oracle_pub_key
    @receiver = receiver
  end

  runar_public price: Bigint, rabin_sig: RabinSig, padding: ByteString, sig: Sig
  def settle(price, rabin_sig, padding, sig)
    msg = num2bin(price, 8)
    assert verify_rabin_sig(msg, rabin_sig, padding, @oracle_pub_key)
    assert price > 50_000
    assert check_sig(sig, @receiver)
  end
end
`,
    constructorArgs: {
      oraclePubKey: 1852673427797059126777135760139020137744618460251467317973768694675137031965589n,
      receiver: ALICE.pubKey,
    },
    methodCall: {
      method: 'settle',
      args: [
        { type: 'bigint', value: '60000' },
        { type: 'bigint', value: '195594275932023152769541819028047709452880413796780214800172974889079016519477' },
        { type: 'ByteString', value: '04' },
        { type: 'Sig', signer: 'alice' },
      ],
    },
    description: 'Oracle-verified price feed with Rabin signature. Price must exceed 50,000 threshold.',
  },
  {
    id: 'blake3',
    name: 'BLAKE3 Hash Test',
    language: 'typescript',
    source: `import { SmartContract, assert, blake3Compress, blake3Hash } from 'runar-lang';
import type { ByteString } from 'runar-lang';

/**
 * Blake3Test — A stateless contract demonstrating the built-in BLAKE3 hash
 * primitives available in Runar.
 *
 * **What is BLAKE3?**
 * BLAKE3 is a modern cryptographic hash function published in 2020, designed as
 * the successor to BLAKE2. It is based on the Bao tree hashing mode and uses a
 * compression function derived from BLAKE2s with reduced rounds (7 instead of
 * 10). BLAKE3 produces a 256-bit (32-byte) digest and is designed for speed,
 * security, and parallelism. Its compression function operates on a 16-word
 * (64-byte) internal state using a series of quarter-round "G" mixing calls.
 *
 * **How BLAKE3 compression works (blake3Compress):**
 * The core primitive is a single compression function invocation. It takes:
 * - A 32-byte chaining value (8 x 32-bit words)
 * - A 64-byte message block (16 x 32-bit words)
 *
 * The compression initializes a 16-word state from the chaining value, the
 * BLAKE3 initialization vector (IV), a counter (hardcoded to 0), the block
 * length, and domain separation flags. It then runs 7 rounds, each consisting
 * of 8 quarter-round G function calls (4 column mixing + 4 diagonal mixing).
 * Between rounds, the message words are permuted. The final output XORs the
 * first 8 state words with the last 8 to produce the 32-byte hash.
 *
 * The G function performs:
 *   a = a + b + mx
 *   d = (d ^ a) >>> 16
 *   c = c + d
 *   b = (b ^ c) >>> 12
 *   a = a + b + my
 *   d = (d ^ a) >>> 8
 *   c = c + d
 *   b = (b ^ c) >>> 7
 *
 * The compiled Bitcoin Script for blake3Compress is approximately 10,000
 * opcodes (~11 KB), making it practical for on-chain hash verification.
 *
 * **How blake3Hash works:**
 * \`blake3Hash(message)\` is a convenience wrapper for single-block hashing. It
 * zero-pads the message to 64 bytes and calls the compression function with
 * the BLAKE3 IV as the chaining value. The hardcoded parameters are:
 * - blockLen = 64 (full block, even if the message is shorter)
 * - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
 * - counter = 0
 *
 * This means blake3Hash handles messages up to 64 bytes in a single
 * compression call. For longer messages, use blake3Compress directly with
 * appropriate chaining.
 *
 * **BLAKE3 IV (big-endian hex):**
 * \`6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19\`
 * (These are the same fractional-part constants used by SHA-256.)
 *
 * **Use cases:**
 * - Proof-of-work verification: verify that a preimage hashes to a target
 * - Hash-locked payments: lock funds to a BLAKE3 preimage (alternative to SHA-256)
 * - Commitment schemes: commit to a value with BLAKE3, reveal later
 * - Data integrity: verify that on-chain data matches an expected digest
 * - Hybrid hash protocols: combine BLAKE3 with SHA-256 for defense in depth
 *
 * This contract is stateless (\`SmartContract\`), so each method is an
 * independent spending condition. The \`expected\` property is baked into the
 * locking script at deployment time.
 */
class Blake3Test extends SmartContract {
  /**
   * The expected 32-byte BLAKE3 digest. Set at deployment time as part of the
   * locking script. Each spending method computes a BLAKE3 hash from unlocking
   * arguments and asserts it matches this value.
   */
  readonly expected: ByteString;

  constructor(expected: ByteString) {
    super(expected);
    this.expected = expected;
  }

  // -------------------------------------------------------------------
  // Low-level compression
  // -------------------------------------------------------------------

  /**
   * Verify a BLAKE3 compression function invocation.
   *
   * Computes \`blake3Compress(chainingValue, block)\` and asserts the 32-byte
   * result matches \`this.expected\`. This is the raw compression primitive —
   * the caller provides both the chaining value and the full 64-byte block.
   *
   * The compression uses hardcoded parameters:
   * - counter = 0 (first and only chunk)
   * - blockLen = 64 (full block)
   * - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
   *
   * Use this method when you need full control over the chaining value, for
   * example when verifying intermediate nodes in a BLAKE3 Merkle tree or
   * when implementing multi-block BLAKE3 hashing with custom chaining.
   *
   * @param chainingValue - 32-byte chaining value (typically the BLAKE3 IV
   *   for the first block, or the output of a previous compression for
   *   subsequent blocks)
   * @param block - 64-byte message block (zero-padded if the message is
   *   shorter than 64 bytes)
   */
  public verifyCompress(chainingValue: ByteString, block: ByteString) {
    const result = blake3Compress(chainingValue, block);
    assert(result === this.expected);
  }

  // -------------------------------------------------------------------
  // Convenience single-block hash
  // -------------------------------------------------------------------

  /**
   * Verify a BLAKE3 hash of a message up to 64 bytes.
   *
   * Computes \`blake3Hash(message)\` and asserts the 32-byte result matches
   * \`this.expected\`. This is the high-level convenience function — it
   * automatically zero-pads the message to 64 bytes and uses the BLAKE3 IV
   * as the chaining value.
   *
   * This is the simplest way to verify a BLAKE3 hash on-chain. The spender
   * provides the preimage (message) and the script verifies it hashes to
   * the expected digest baked into the locking script.
   *
   * Equivalent to:
   *   blake3Compress(BLAKE3_IV, zeroPad(message, 64))
   *
   * Note: blockLen is hardcoded to 64 in the compiled script regardless of
   * the actual message length. This means the hash output differs from a
   * standard BLAKE3 implementation that uses the true message length as
   * blockLen. For interoperability with off-chain BLAKE3 libraries, use
   * blake3Compress directly with the correct blockLen encoding.
   *
   * @param message - The message to hash (up to 64 bytes; will be zero-padded)
   */
  public verifyHash(message: ByteString) {
    const result = blake3Hash(message);
    assert(result === this.expected);
  }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verifyHash',
      args: [
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'BLAKE3 hash verification on-chain. Demonstrates blake3Compress and blake3Hash primitives.',
  },
  {
    id: 'sol-blake3',
    name: 'BLAKE3 Hash Test (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title Blake3Test
/// @notice A stateless contract demonstrating BLAKE3 hash primitives in Runar.
/// @dev BLAKE3 is a cryptographic hash function that is significantly faster
/// than SHA-256 while maintaining strong security guarantees. Runar provides
/// two BLAKE3 built-in functions that compile into inlined Bitcoin Script
/// opcodes for on-chain hash verification.
///
/// BLAKE3 internals:
///   - Uses a Merkle tree structure built from 64-byte blocks
///   - Each block is processed by the BLAKE3 compression function
///   - The compression function mixes a 32-byte chaining value with a 64-byte
///     block using 7 rounds of the BLAKE3 G mixing function
///   - The standard IV (initialization vector) is:
///     6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19
///     (same as the first 8 words of SHA-256's IV, derived from sqrt(2..9))
///
/// The 2 BLAKE3 primitives:
///   blake3Compress(chainingValue, block) — single-block compression
///   blake3Hash(message) — full hash for messages up to 64 bytes
///
/// blake3Compress takes a 32-byte chaining value and a 64-byte block,
/// returning the 32-byte compressed output. This is the core building block
/// for constructing custom BLAKE3 Merkle trees on-chain.
///
/// blake3Hash computes the full BLAKE3 hash of a message (up to 64 bytes),
/// handling IV initialization, padding, and domain flags internally. This is
/// the simplest way to verify a BLAKE3 hash on-chain.
///
/// This contract is stateless (SmartContract), so each method is an
/// independent spending condition. No signature checks are performed.
contract Blake3Test is SmartContract {
    /// @notice The expected hash output (32 bytes).
    /// @dev Set at deployment time; each spending method verifies its computed
    /// result against this value.
    ByteString immutable expected;

    /// @param _expected The expected BLAKE3 output (32-byte hash)
    constructor(ByteString _expected) {
        expected = _expected;
    }

    /// @notice Verify a single BLAKE3 compression invocation.
    /// @dev Compresses a 64-byte block using the given 32-byte chaining value
    /// and asserts the result matches the stored expected hash. This is useful
    /// for verifying individual nodes in a BLAKE3 Merkle tree.
    /// @param chainingValue The 32-byte chaining value (e.g., BLAKE3 IV for the first block)
    /// @param block The 64-byte data block to compress
    function verifyCompress(ByteString chainingValue, ByteString block) public {
        ByteString result = blake3Compress(chainingValue, block);
        require(result == this.expected);
    }

    /// @notice Verify a full BLAKE3 hash of a message.
    /// @dev Computes blake3Hash(message) and asserts the result matches the
    /// stored expected hash. The message must be at most 64 bytes. This is the
    /// simplest on-chain BLAKE3 verification: deploy with the expected digest,
    /// then spend by providing the preimage.
    /// @param message The message to hash (up to 64 bytes)
    function verifyHash(ByteString message) public {
        ByteString result = blake3Hash(message);
        require(result == this.expected);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verifyHash',
      args: [
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'BLAKE3 hash verification on-chain. Demonstrates blake3Compress and blake3Hash primitives.',
  },
  {
    id: 'move-blake3',
    name: 'BLAKE3 Hash Test (Move)',
    language: 'move',
    source: `// Blake3Test — A stateless contract demonstrating BLAKE3 hash primitives
// in Runar.
//
// BLAKE3 is a cryptographic hash function that is significantly faster
// than SHA-256 while maintaining strong security guarantees. Runar provides
// two BLAKE3 built-in functions that compile into inlined Bitcoin Script
// opcodes for on-chain hash verification.
//
// BLAKE3 internals:
//   - Uses a Merkle tree structure built from 64-byte blocks
//   - Each block is processed by the BLAKE3 compression function
//   - The compression function mixes a 32-byte chaining value with a 64-byte
//     block using 7 rounds of the BLAKE3 G mixing function
//   - The standard IV (initialization vector) is:
//     6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19
//     (same as the first 8 words of SHA-256's IV, derived from sqrt(2..9))
//
// The 2 BLAKE3 primitives:
//   blake3Compress(chainingValue, block) — single-block compression
//   blake3Hash(message) — full hash for messages up to 64 bytes
//
// blake3Compress takes a 32-byte chaining value and a 64-byte block,
// returning the 32-byte compressed output. This is the core building block
// for constructing custom BLAKE3 Merkle trees on-chain.
//
// blake3Hash computes the full BLAKE3 hash of a message (up to 64 bytes),
// handling IV initialization, padding, and domain flags internally. This is
// the simplest way to verify a BLAKE3 hash on-chain.
//
// This contract is stateless (SmartContract), so each method is an
// independent spending condition. No signature checks are performed.
module Blake3Test {
    use runar::types::{ByteString};
    use runar::crypto::{blake3Compress, blake3Hash};

    struct Blake3Test {
        // The expected hash output (32 bytes).
        // Set at deployment time; each spending method verifies its computed
        // result against this value.
        expected: ByteString,
    }

    // Verify a single BLAKE3 compression invocation.
    // Compresses a 64-byte block using the given 32-byte chaining value
    // and asserts the result matches the stored expected hash. This is useful
    // for verifying individual nodes in a BLAKE3 Merkle tree.
    public fun verify_compress(contract: &Blake3Test, chaining_value: ByteString, block: ByteString) {
        let result: ByteString = blake3Compress(chaining_value, block);
        assert!(result == contract.expected, 0);
    }

    // Verify a full BLAKE3 hash of a message.
    // Computes blake3Hash(message) and asserts the result matches the
    // stored expected hash. The message must be at most 64 bytes. This is the
    // simplest on-chain BLAKE3 verification: deploy with the expected digest,
    // then spend by providing the preimage.
    public fun verify_hash(contract: &Blake3Test, message: ByteString) {
        let result: ByteString = blake3Hash(message);
        assert!(result == contract.expected, 0);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verifyHash',
      args: [
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'BLAKE3 hash verification on-chain. Demonstrates blake3Compress and blake3Hash primitives.',
  },
  {
    id: 'go-blake3',
    name: 'BLAKE3 Hash Test (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// Blake3Test is a stateless contract demonstrating the built-in BLAKE3 hash
// primitives available in Runar.
//
// What is BLAKE3?
//
// BLAKE3 is a modern cryptographic hash function published in 2020, designed as
// the successor to BLAKE2. It is based on the Bao tree hashing mode and uses a
// compression function derived from BLAKE2s with reduced rounds (7 instead of
// 10). BLAKE3 produces a 256-bit (32-byte) digest and is designed for speed,
// security, and parallelism. Its compression function operates on a 16-word
// (64-byte) internal state using a series of quarter-round "G" mixing calls.
//
// How BLAKE3 compression works (Blake3Compress):
//
// The core primitive is a single compression function invocation. It takes:
//   - A 32-byte chaining value (8 x 32-bit words)
//   - A 64-byte message block (16 x 32-bit words)
//
// The compression initializes a 16-word state from the chaining value, the
// BLAKE3 initialization vector (IV), a counter (hardcoded to 0), the block
// length, and domain separation flags. It then runs 7 rounds, each consisting
// of 8 quarter-round G function calls (4 column mixing + 4 diagonal mixing).
// Between rounds, the message words are permuted. The final output XORs the
// first 8 state words with the last 8 to produce the 32-byte hash.
//
// The G function performs:
//
//	a = a + b + mx
//	d = (d ^ a) >>> 16
//	c = c + d
//	b = (b ^ c) >>> 12
//	a = a + b + my
//	d = (d ^ a) >>> 8
//	c = c + d
//	b = (b ^ c) >>> 7
//
// The compiled Bitcoin Script for Blake3Compress is approximately 10,000
// opcodes (~11 KB), making it practical for on-chain hash verification.
//
// How Blake3Hash works:
//
// Blake3Hash(message) is a convenience wrapper for single-block hashing. It
// zero-pads the message to 64 bytes and calls the compression function with
// the BLAKE3 IV as the chaining value. The hardcoded parameters are:
//   - blockLen = 64 (full block, even if the message is shorter)
//   - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
//   - counter = 0
//
// This means Blake3Hash handles messages up to 64 bytes in a single
// compression call. For longer messages, use Blake3Compress directly with
// appropriate chaining.
//
// BLAKE3 IV (big-endian hex):
//
//	6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19
//
// (These are the same fractional-part constants used by SHA-256.)
//
// Use cases:
//   - Proof-of-work verification: verify that a preimage hashes to a target
//   - Hash-locked payments: lock funds to a BLAKE3 preimage (alternative to SHA-256)
//   - Commitment schemes: commit to a value with BLAKE3, reveal later
//   - Data integrity: verify that on-chain data matches an expected digest
//   - Hybrid hash protocols: combine BLAKE3 with SHA-256 for defense in depth
//
// This contract is stateless (SmartContract), so each method is an independent
// spending condition. The Expected property is baked into the locking script
// at deployment time.
type Blake3Test struct {
	runar.SmartContract
	// Expected is the expected 32-byte BLAKE3 digest. Set at deployment time
	// as part of the locking script. Each spending method computes a BLAKE3
	// hash from unlocking arguments and asserts it matches this value.
	Expected runar.ByteString \`runar:"readonly"\`
}

// VerifyCompress verifies a BLAKE3 compression function invocation.
//
// Computes Blake3Compress(chainingValue, block) and asserts the 32-byte
// result matches the stored Expected value. This is the raw compression
// primitive — the caller provides both the chaining value and the full
// 64-byte block.
//
// The compression uses hardcoded parameters:
//   - counter = 0 (first and only chunk)
//   - blockLen = 64 (full block)
//   - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
//
// Use this method when you need full control over the chaining value, for
// example when verifying intermediate nodes in a BLAKE3 Merkle tree or
// when implementing multi-block BLAKE3 hashing with custom chaining.
func (c *Blake3Test) VerifyCompress(chainingValue runar.ByteString, block runar.ByteString) {
	result := runar.Blake3Compress(chainingValue, block)
	runar.Assert(result == c.Expected)
}

// VerifyHash verifies a BLAKE3 hash of a message up to 64 bytes.
//
// Computes Blake3Hash(message) and asserts the 32-byte result matches
// the stored Expected value. This is the high-level convenience function —
// it automatically zero-pads the message to 64 bytes and uses the BLAKE3 IV
// as the chaining value.
//
// This is the simplest way to verify a BLAKE3 hash on-chain. The spender
// provides the preimage (message) and the script verifies it hashes to
// the expected digest baked into the locking script.
//
// Note: blockLen is hardcoded to 64 in the compiled script regardless of
// the actual message length. This means the hash output differs from a
// standard BLAKE3 implementation that uses the true message length as
// blockLen. For interoperability with off-chain BLAKE3 libraries, use
// Blake3Compress directly with the correct blockLen encoding.
func (c *Blake3Test) VerifyHash(message runar.ByteString) {
	result := runar.Blake3Hash(message)
	runar.Assert(result == c.Expected)
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verifyHash',
      args: [
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'BLAKE3 hash verification on-chain. Demonstrates blake3Compress and blake3Hash primitives.',
  },
  {
    id: 'rust-blake3',
    name: 'BLAKE3 Hash Test (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// Blake3Test -- A stateless contract demonstrating the built-in BLAKE3 hash
/// primitives available in Runar.
///
/// **What is BLAKE3?**
/// BLAKE3 is a modern cryptographic hash function published in 2020, designed as
/// the successor to BLAKE2. It is based on the Bao tree hashing mode and uses a
/// compression function derived from BLAKE2s with reduced rounds (7 instead of
/// 10). BLAKE3 produces a 256-bit (32-byte) digest and is designed for speed,
/// security, and parallelism. Its compression function operates on a 16-word
/// (64-byte) internal state using a series of quarter-round "G" mixing calls.
///
/// **How BLAKE3 compression works (\`blake3_compress\`):**
/// The core primitive is a single compression function invocation. It takes:
/// - A 32-byte chaining value (8 x 32-bit words)
/// - A 64-byte message block (16 x 32-bit words)
///
/// The compression initializes a 16-word state from the chaining value, the
/// BLAKE3 initialization vector (IV), a counter (hardcoded to 0), the block
/// length, and domain separation flags. It then runs 7 rounds, each consisting
/// of 8 quarter-round G function calls (4 column mixing + 4 diagonal mixing).
/// Between rounds, the message words are permuted. The final output XORs the
/// first 8 state words with the last 8 to produce the 32-byte hash.
///
/// The G function performs:
/// \`\`\`text
/// a = a + b + mx
/// d = (d ^ a) >>> 16
/// c = c + d
/// b = (b ^ c) >>> 12
/// a = a + b + my
/// d = (d ^ a) >>> 8
/// c = c + d
/// b = (b ^ c) >>> 7
/// \`\`\`
///
/// The compiled Bitcoin Script for \`blake3_compress\` is approximately 10,000
/// opcodes (~11 KB), making it practical for on-chain hash verification.
///
/// **How \`blake3_hash\` works:**
/// \`blake3_hash(message)\` is a convenience wrapper for single-block hashing. It
/// zero-pads the message to 64 bytes and calls the compression function with
/// the BLAKE3 IV as the chaining value. The hardcoded parameters are:
/// - blockLen = 64 (full block, even if the message is shorter)
/// - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
/// - counter = 0
///
/// **BLAKE3 IV (big-endian hex):**
/// \`6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19\`
/// (These are the same fractional-part constants used by SHA-256.)
///
/// **Use cases:**
/// - Proof-of-work verification: verify that a preimage hashes to a target
/// - Hash-locked payments: lock funds to a BLAKE3 preimage (alternative to SHA-256)
/// - Commitment schemes: commit to a value with BLAKE3, reveal later
/// - Data integrity: verify that on-chain data matches an expected digest
/// - Hybrid hash protocols: combine BLAKE3 with SHA-256 for defense in depth
#[runar::contract]
pub struct Blake3Test {
    /// The expected 32-byte BLAKE3 digest. Set at deployment time as part of
    /// the locking script. Each spending method computes a BLAKE3 hash from
    /// unlocking arguments and asserts it matches this value.
    #[readonly]
    pub expected: ByteString,
}

#[runar::methods(Blake3Test)]
impl Blake3Test {
    /// Verify a BLAKE3 compression function invocation.
    ///
    /// Computes \`blake3_compress(chaining_value, block)\` and asserts the
    /// 32-byte result matches \`self.expected\`. This is the raw compression
    /// primitive -- the caller provides both the chaining value and the
    /// full 64-byte block.
    ///
    /// The compression uses hardcoded parameters:
    /// - counter = 0 (first and only chunk)
    /// - blockLen = 64 (full block)
    /// - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
    ///
    /// Use this method when you need full control over the chaining value,
    /// for example when verifying intermediate nodes in a BLAKE3 Merkle tree
    /// or when implementing multi-block BLAKE3 hashing with custom chaining.
    #[public]
    pub fn verify_compress(&self, chaining_value: &ByteString, block: &ByteString) {
        let result = blake3_compress(chaining_value, block);
        assert!(result == self.expected);
    }

    /// Verify a BLAKE3 hash of a message up to 64 bytes.
    ///
    /// Computes \`blake3_hash(message)\` and asserts the 32-byte result
    /// matches \`self.expected\`. This is the high-level convenience function --
    /// it automatically zero-pads the message to 64 bytes and uses the
    /// BLAKE3 IV as the chaining value.
    ///
    /// This is the simplest way to verify a BLAKE3 hash on-chain. The
    /// spender provides the preimage (message) and the script verifies it
    /// hashes to the expected digest baked into the locking script.
    ///
    /// Note: blockLen is hardcoded to 64 in the compiled script regardless
    /// of the actual message length. For interoperability with off-chain
    /// BLAKE3 libraries, use \`blake3_compress\` directly with the correct
    /// blockLen encoding.
    #[public]
    pub fn verify_hash(&self, message: &ByteString) {
        let result = blake3_hash(message);
        assert!(result == self.expected);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verifyHash',
      args: [
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'BLAKE3 hash verification on-chain. Demonstrates blake3Compress and blake3Hash primitives.',
  },
  {
    id: 'python-blake3',
    name: 'BLAKE3 Hash Test (Python)',
    language: 'python',
    source: `"""Blake3Test -- A stateless contract demonstrating the built-in BLAKE3 hash
primitives available in Runar.

What is BLAKE3?

BLAKE3 is a modern cryptographic hash function published in 2020, designed as
the successor to BLAKE2. It is based on the Bao tree hashing mode and uses a
compression function derived from BLAKE2s with reduced rounds (7 instead of
10). BLAKE3 produces a 256-bit (32-byte) digest and is designed for speed,
security, and parallelism. Its compression function operates on a 16-word
(64-byte) internal state using a series of quarter-round "G" mixing calls.

How BLAKE3 compression works (blake3_compress):

The core primitive is a single compression function invocation. It takes:
  - A 32-byte chaining value (8 x 32-bit words)
  - A 64-byte message block (16 x 32-bit words)

The compression initializes a 16-word state from the chaining value, the
BLAKE3 initialization vector (IV), a counter (hardcoded to 0), the block
length, and domain separation flags. It then runs 7 rounds, each consisting
of 8 quarter-round G function calls (4 column mixing + 4 diagonal mixing).
Between rounds, the message words are permuted. The final output XORs the
first 8 state words with the last 8 to produce the 32-byte hash.

The G function performs::

    a = a + b + mx
    d = (d ^ a) >>> 16
    c = c + d
    b = (b ^ c) >>> 12
    a = a + b + my
    d = (d ^ a) >>> 8
    c = c + d
    b = (b ^ c) >>> 7

The compiled Bitcoin Script for blake3_compress is approximately 10,000
opcodes (~11 KB), making it practical for on-chain hash verification.

How blake3_hash works:

\`\`blake3_hash(message)\`\` is a convenience wrapper for single-block hashing. It
zero-pads the message to 64 bytes and calls the compression function with
the BLAKE3 IV as the chaining value. The hardcoded parameters are:
  - blockLen = 64 (full block, even if the message is shorter)
  - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
  - counter = 0

BLAKE3 IV (big-endian hex)::

    6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19

(These are the same fractional-part constants used by SHA-256.)

Use cases:
  - Proof-of-work verification: verify that a preimage hashes to a target
  - Hash-locked payments: lock funds to a BLAKE3 preimage (alternative to SHA-256)
  - Commitment schemes: commit to a value with BLAKE3, reveal later
  - Data integrity: verify that on-chain data matches an expected digest
  - Hybrid hash protocols: combine BLAKE3 with SHA-256 for defense in depth
"""

from runar import SmartContract, ByteString, public, assert_, blake3_compress, blake3_hash


class Blake3Test(SmartContract):
    """Demonstrates BLAKE3 hash primitives: compression and single-block hash.

    Stores an \`\`expected\`\` 32-byte digest as a readonly contract property.
    Each spending method computes a BLAKE3 hash from unlocking arguments and
    asserts it matches the expected value.

    Args:
        expected: The expected 32-byte BLAKE3 digest baked into the locking
            script at deployment time.
    """

    expected: ByteString

    def __init__(self, expected: ByteString):
        super().__init__(expected)
        self.expected = expected

    @public
    def verify_compress(self, chaining_value: ByteString, block: ByteString):
        """Verify a BLAKE3 compression function invocation.

        Computes \`\`blake3_compress(chaining_value, block)\`\` and asserts the
        32-byte result matches \`\`self.expected\`\`. This is the raw compression
        primitive -- the caller provides both the chaining value and the full
        64-byte block.

        The compression uses hardcoded parameters:
          - counter = 0 (first and only chunk)
          - blockLen = 64 (full block)
          - flags = 11 (CHUNK_START | CHUNK_END | ROOT)

        Use this method when you need full control over the chaining value,
        for example when verifying intermediate nodes in a BLAKE3 Merkle tree
        or when implementing multi-block BLAKE3 hashing with custom chaining.

        Args:
            chaining_value: 32-byte chaining value (typically the BLAKE3 IV
                for the first block, or the output of a previous compression
                for subsequent blocks).
            block: 64-byte message block (zero-padded if the message is
                shorter than 64 bytes).
        """
        result = blake3_compress(chaining_value, block)
        assert_(result == self.expected)

    @public
    def verify_hash(self, message: ByteString):
        """Verify a BLAKE3 hash of a message up to 64 bytes.

        Computes \`\`blake3_hash(message)\`\` and asserts the 32-byte result
        matches \`\`self.expected\`\`. This is the high-level convenience
        function -- it automatically zero-pads the message to 64 bytes and
        uses the BLAKE3 IV as the chaining value.

        This is the simplest way to verify a BLAKE3 hash on-chain. The
        spender provides the preimage (message) and the script verifies it
        hashes to the expected digest baked into the locking script.

        Note: blockLen is hardcoded to 64 in the compiled script regardless
        of the actual message length. For interoperability with off-chain
        BLAKE3 libraries, use \`\`blake3_compress\`\` directly with the correct
        blockLen encoding.

        Args:
            message: The message to hash (up to 64 bytes; will be zero-padded).
        """
        result = blake3_hash(message)
        assert_(result == self.expected)
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verifyHash',
      args: [
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'BLAKE3 hash verification on-chain. Demonstrates blake3Compress and blake3Hash primitives.',
  },
  {
    id: 'zig-blake3',
    name: 'BLAKE3 Hash Test (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const Blake3Test = struct {
    pub const Contract = runar.SmartContract;

    expected: runar.ByteString,

    pub fn init(expected: runar.ByteString) Blake3Test {
        return .{ .expected = expected };
    }

    pub fn verifyCompress(self: *const Blake3Test, chainingValue: runar.ByteString, block: runar.ByteString) void {
        runar.assert(runar.bytesEq(runar.blake3Compress(chainingValue, block), self.expected));
    }

    pub fn verifyHash(self: *const Blake3Test, message: runar.ByteString) void {
        runar.assert(runar.bytesEq(runar.blake3Hash(message), self.expected));
    }
};
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verifyHash',
      args: [
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'BLAKE3 hash verification on-chain. Demonstrates blake3Compress and blake3Hash primitives.',
  },
  {
    id: 'ruby-blake3',
    name: 'BLAKE3 Hash Test (Ruby)',
    language: 'ruby',
    source: `require 'runar'

# Blake3Test -- A stateless contract demonstrating the built-in BLAKE3 hash
# primitives available in Runar.
#
# What is BLAKE3?
#
# BLAKE3 is a modern cryptographic hash function published in 2020, designed as
# the successor to BLAKE2. It is based on the Bao tree hashing mode and uses a
# compression function derived from BLAKE2s with reduced rounds (7 instead of
# 10). BLAKE3 produces a 256-bit (32-byte) digest and is designed for speed,
# security, and parallelism. Its compression function operates on a 16-word
# (64-byte) internal state using a series of quarter-round "G" mixing calls.
#
# How BLAKE3 compression works (blake3_compress):
#
# The core primitive is a single compression function invocation. It takes:
#   - A 32-byte chaining value (8 x 32-bit words)
#   - A 64-byte message block (16 x 32-bit words)
#
# The compression initializes a 16-word state from the chaining value, the
# BLAKE3 initialization vector (IV), a counter (hardcoded to 0), the block
# length, and domain separation flags. It then runs 7 rounds, each consisting
# of 8 quarter-round G function calls (4 column mixing + 4 diagonal mixing).
# Between rounds, the message words are permuted. The final output XORs the
# first 8 state words with the last 8 to produce the 32-byte hash.
#
# The G function performs:
#   a = a + b + mx
#   d = (d ^ a) >>> 16
#   c = c + d
#   b = (b ^ c) >>> 12
#   a = a + b + my
#   d = (d ^ a) >>> 8
#   c = c + d
#   b = (b ^ c) >>> 7
#
# The compiled Bitcoin Script for blake3_compress is approximately 10,000
# opcodes (~11 KB), making it practical for on-chain hash verification.
#
# How blake3_hash works:
#
# blake3_hash(message) is a convenience wrapper for single-block hashing. It
# zero-pads the message to 64 bytes and calls the compression function with
# the BLAKE3 IV as the chaining value. The hardcoded parameters are:
#   - blockLen = 64 (full block, even if the message is shorter)
#   - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
#   - counter = 0
#
# BLAKE3 IV (big-endian hex):
#   6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19
# (These are the same fractional-part constants used by SHA-256.)
#
# Use cases:
#   - Proof-of-work verification: verify that a preimage hashes to a target
#   - Hash-locked payments: lock funds to a BLAKE3 preimage (alternative to SHA-256)
#   - Commitment schemes: commit to a value with BLAKE3, reveal later
#   - Data integrity: verify that on-chain data matches an expected digest
#   - Hybrid hash protocols: combine BLAKE3 with SHA-256 for defense in depth

class Blake3Test < Runar::SmartContract
  # The expected 32-byte BLAKE3 digest. Set at deployment time as part of the
  # locking script. Each spending method computes a BLAKE3 hash from unlocking
  # arguments and asserts it matches this value.
  prop :expected, ByteString

  def initialize(expected)
    super(expected)
    @expected = expected
  end

  # Verify a BLAKE3 compression function invocation.
  #
  # Computes blake3_compress(chaining_value, block) and asserts the 32-byte
  # result matches @expected. This is the raw compression primitive -- the
  # caller provides both the chaining value and the full 64-byte block.
  #
  # The compression uses hardcoded parameters:
  #   - counter = 0 (first and only chunk)
  #   - blockLen = 64 (full block)
  #   - flags = 11 (CHUNK_START | CHUNK_END | ROOT)
  #
  # Use this method when you need full control over the chaining value, for
  # example when verifying intermediate nodes in a BLAKE3 Merkle tree or when
  # implementing multi-block BLAKE3 hashing with custom chaining.
  runar_public chaining_value: ByteString, block: ByteString
  def verify_compress(chaining_value, block)
    result = blake3_compress(chaining_value, block)
    assert result == @expected
  end

  # Verify a BLAKE3 hash of a message up to 64 bytes.
  #
  # Computes blake3_hash(message) and asserts the 32-byte result matches
  # @expected. This is the high-level convenience function -- it automatically
  # zero-pads the message to 64 bytes and uses the BLAKE3 IV as the chaining
  # value.
  #
  # This is the simplest way to verify a BLAKE3 hash on-chain. The spender
  # provides the preimage (message) and the script verifies it hashes to the
  # expected digest baked into the locking script.
  #
  # Note: blockLen is hardcoded to 64 in the compiled script regardless of the
  # actual message length. For interoperability with off-chain BLAKE3 libraries,
  # use blake3_compress directly with the correct blockLen encoding.
  runar_public message: ByteString
  def verify_hash(message)
    result = blake3_hash(message)
    assert result == @expected
  end
end
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verifyHash',
      args: [
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'BLAKE3 hash verification on-chain. Demonstrates blake3Compress and blake3Hash primitives.',
  },
  {
    id: 'convergence-proof',
    name: 'Convergence Proof',
    language: 'typescript',
    source: `import {
  SmartContract, assert,
  ecAdd, ecNegate, ecMulGen, ecPointX, ecPointY, ecOnCurve,
} from 'runar-lang';
import type { Point } from 'runar-lang';

/**
 * OPRF-based fraud signal convergence proof.
 *
 * Two parties submit randomized tokens R_A = (T + o_A)·G and R_B = (T + o_B)·G
 * where T is the shared underlying token and o_A, o_B are ECDH-derived offsets.
 *
 * An authority who knows both offsets can prove the two submissions share the
 * same token T by providing Δo = o_A - o_B and verifying:
 *
 *   R_A - R_B = Δo · G
 *
 * The token T cancels out in the subtraction, proving convergence without
 * revealing T. Spending this UTXO serves as a formal on-chain subpoena trigger.
 */
class ConvergenceProof extends SmartContract {
  readonly rA: Point;
  readonly rB: Point;

  constructor(rA: Point, rB: Point) {
    super(rA, rB);
    this.rA = rA;
    this.rB = rB;
  }

  /**
   * Prove convergence via offset difference.
   *
   * @param deltaO - The offset difference o_A - o_B (mod n), provided by authority
   */
  public proveConvergence(deltaO: bigint) {
    // Verify both committed points are on the curve
    assert(ecOnCurve(this.rA));
    assert(ecOnCurve(this.rB));

    // R_A - R_B (point subtraction = addition with negated second operand)
    const diff = ecAdd(this.rA, ecNegate(this.rB));

    // Δo · G (scalar multiplication of generator)
    const expected = ecMulGen(deltaO);

    // Assert point equality via coordinate comparison
    assert(ecPointX(diff) === ecPointX(expected));
    assert(ecPointY(diff) === ecPointY(expected));
  }
}
`,
    constructorArgs: {
      rA: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      rB: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'proveConvergence',
      args: [
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'OPRF-based fraud signal convergence proof using elliptic curve point subtraction.',
  },
  {
    id: 'go-convergence-proof',
    name: 'Convergence Proof (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// ConvergenceProof verifies OPRF-based fraud signal convergence.
//
// Two parties submit randomized tokens R_A = (T + o_A)*G and R_B = (T + o_B)*G
// where T is the shared underlying token and o_A, o_B are ECDH-derived offsets.
//
// An authority who knows both offsets can prove the two submissions share the
// same token T by providing Δo = o_A - o_B and verifying:
//
//	R_A - R_B = Δo · G
//
// The token T cancels out in the subtraction, proving convergence without
// revealing T. Spending this UTXO serves as a formal on-chain subpoena trigger.
type ConvergenceProof struct {
	runar.SmartContract
	RA runar.Point \`runar:"readonly"\`
	RB runar.Point \`runar:"readonly"\`
}

// ProveConvergence verifies convergence via offset difference.
//
// deltaO is the offset difference o_A - o_B (mod n), provided by the authority.
func (c *ConvergenceProof) ProveConvergence(deltaO runar.Bigint) {
	// Verify both committed points are on the curve
	runar.Assert(runar.EcOnCurve(c.RA))
	runar.Assert(runar.EcOnCurve(c.RB))

	// R_A - R_B (point subtraction = add + negate)
	diff := runar.EcAdd(c.RA, runar.EcNegate(c.RB))

	// Δo · G (scalar multiplication of generator)
	expected := runar.EcMulGen(deltaO)

	// Assert point equality via coordinate comparison
	runar.Assert(runar.EcPointX(diff) == runar.EcPointX(expected))
	runar.Assert(runar.EcPointY(diff) == runar.EcPointY(expected))
}
`,
    constructorArgs: {
      rA: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      rB: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'proveConvergence',
      args: [
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'OPRF-based fraud signal convergence proof using elliptic curve point subtraction.',
  },
  {
    id: 'rust-convergence-proof',
    name: 'Convergence Proof (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// OPRF-based fraud signal convergence proof.
///
/// Two parties submit randomized tokens R_A = (T + o_A)*G and R_B = (T + o_B)*G
/// where T is the shared underlying token and o_A, o_B are ECDH-derived offsets.
///
/// An authority who knows both offsets can prove the two submissions share the
/// same token T by providing Δo = o_A - o_B and verifying:
///
/// \`\`\`text
/// R_A - R_B = Δo · G
/// \`\`\`
///
/// The token T cancels out in the subtraction, proving convergence without
/// revealing T. Spending this UTXO serves as a formal on-chain subpoena trigger.
#[runar::contract]
pub struct ConvergenceProof {
    #[readonly]
    pub r_a: Point,
    #[readonly]
    pub r_b: Point,
}

#[runar::methods(ConvergenceProof)]
impl ConvergenceProof {
    /// Prove convergence via offset difference.
    ///
    /// \`delta_o\` is the offset difference o_A - o_B (mod n), provided by the authority.
    #[public]
    pub fn prove_convergence(&self, delta_o: Bigint) {
        // Verify both committed points are on the curve
        assert!(ec_on_curve(&self.r_a));
        assert!(ec_on_curve(&self.r_b));

        // R_A - R_B (point subtraction = add + negate)
        let diff = ec_add(&self.r_a, &ec_negate(&self.r_b));

        // Δo · G (scalar multiplication of generator)
        let expected = ec_mul_gen(delta_o);

        // Assert point equality via coordinate comparison
        assert!(ec_point_x(&diff) == ec_point_x(&expected));
        assert!(ec_point_y(&diff) == ec_point_y(&expected));
    }
}
`,
    constructorArgs: {
      rA: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      rB: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'proveConvergence',
      args: [
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'OPRF-based fraud signal convergence proof using elliptic curve point subtraction.',
  },
  {
    id: 'python-convergence-proof',
    name: 'Convergence Proof (Python)',
    language: 'python',
    source: `"""OPRF-based fraud signal convergence proof.

Two parties submit randomized tokens R_A = (T + o_A)*G and R_B = (T + o_B)*G
where T is the shared underlying token and o_A, o_B are ECDH-derived offsets.

An authority who knows both offsets can prove the two submissions share the
same token T by providing delta_o = o_A - o_B and verifying:

    R_A - R_B = delta_o * G

The token T cancels out in the subtraction, proving convergence without
revealing T. Spending this UTXO serves as a formal on-chain subpoena trigger.
"""
from runar import (
    SmartContract, Point, Bigint, public, assert_,
    ec_add, ec_negate, ec_mul_gen, ec_point_x, ec_point_y, ec_on_curve,
)

class ConvergenceProof(SmartContract):
    """Verifies that two OPRF-randomized tokens share the same underlying value."""

    r_a: Point
    r_b: Point

    def __init__(self, r_a: Point, r_b: Point):
        super().__init__(r_a, r_b)
        self.r_a = r_a
        self.r_b = r_b

    @public
    def prove_convergence(self, delta_o: Bigint):
        """Prove convergence via offset difference.

        Args:
            delta_o: The offset difference o_A - o_B (mod n), provided by the authority.
        """
        # Verify both committed points are on the curve
        assert_(ec_on_curve(self.r_a))
        assert_(ec_on_curve(self.r_b))

        # R_A - R_B (point subtraction = addition with negated second operand)
        diff = ec_add(self.r_a, ec_negate(self.r_b))

        # delta_o * G (scalar multiplication of generator)
        expected = ec_mul_gen(delta_o)

        # Assert point equality via coordinate comparison
        assert_(ec_point_x(diff) == ec_point_x(expected))
        assert_(ec_point_y(diff) == ec_point_y(expected))
`,
    constructorArgs: {
      rA: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      rB: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'proveConvergence',
      args: [
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'OPRF-based fraud signal convergence proof using elliptic curve point subtraction.',
  },
  {
    id: 'zig-convergence-proof',
    name: 'Convergence Proof (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const ConvergenceProof = struct {
    pub const Contract = runar.SmartContract;

    rA: runar.Point,
    rB: runar.Point,

    pub fn init(rA: runar.Point, rB: runar.Point) ConvergenceProof {
        return .{
            .rA = rA,
            .rB = rB,
        };
    }

    pub fn proveConvergence(self: *const ConvergenceProof, deltaO: i64) void {
        runar.assert(runar.ecOnCurve(self.rA));
        runar.assert(runar.ecOnCurve(self.rB));

        const diff = runar.ecAdd(self.rA, runar.ecNegate(self.rB));
        const expected = runar.ecMulGen(deltaO);

        runar.assert(runar.bytesEq(runar.ecEncodeCompressed(diff), runar.ecEncodeCompressed(expected)));
    }
};
`,
    constructorArgs: {
      rA: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      rB: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'proveConvergence',
      args: [
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'OPRF-based fraud signal convergence proof using elliptic curve point subtraction.',
  },
  {
    id: 'ruby-convergence-proof',
    name: 'Convergence Proof (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class ConvergenceProof < Runar::SmartContract
  prop :r_a, Point
  prop :r_b, Point

  def initialize(r_a, r_b)
    super(r_a, r_b)
    @r_a = r_a
    @r_b = r_b
  end

  runar_public delta_o: Bigint
  def prove_convergence(delta_o)
    assert ec_on_curve(@r_a)
    assert ec_on_curve(@r_b)
    diff = ec_add(@r_a, ec_negate(@r_b))
    expected = ec_mul_gen(delta_o)
    assert ec_point_x(diff) == ec_point_x(expected)
    assert ec_point_y(diff) == ec_point_y(expected)
  end
end
`,
    constructorArgs: {
      rA: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      rB: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'proveConvergence',
      args: [
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'OPRF-based fraud signal convergence proof using elliptic curve point subtraction.',
  },
  {
    id: 'covenant-vault',
    name: 'Covenant Vault',
    language: 'typescript',
    source: `import { SmartContract, assert, PubKey, Sig, Addr, ByteString, SigHashPreimage, checkSig, checkPreimage, extractOutputHash, hash256, num2bin, cat } from 'runar-lang';

/**
 * CovenantVault -- a stateless Bitcoin covenant contract.
 *
 * A covenant is a self-enforcing spending constraint: the locking script
 * dictates not just *who* can spend the funds, but *how* they may be spent.
 * This contract demonstrates the pattern by combining three verification
 * layers in its single public method:
 *
 *   1. Owner authorization  -- the owner's ECDSA signature must be valid
 *      (proves who is spending).
 *   2. Preimage verification -- \`checkPreimage\` (OP_PUSH_TX) proves the
 *      contract is inspecting the real spending transaction, enabling
 *      on-chain introspection of its fields.
 *   3. Covenant rule -- the contract constructs the expected P2PKH output
 *      on-chain (recipient address + \`minAmount\` satoshis) and verifies its
 *      hash against the transaction's \`hashOutputs\` field. This constrains
 *      both the destination and the amount at the consensus level.
 *
 * Script layout (simplified):
 *   Unlocking: <opPushTxSig> <sig> <txPreimage>
 *   Locking:   <pubKey> OP_CHECKSIG OP_VERIFY <checkPreimage>
 *              <buildP2PKH(recipient)> <num2bin(minAmount,8)> OP_CAT
 *              OP_HASH256 <extractOutputHash(preimage)> OP_EQUAL OP_VERIFY
 *
 * Use cases for this pattern include withdrawal limits, time-locked vaults,
 * rate-limited spending, and enforced change addresses.
 *
 * Contract model: Stateless (\`SmartContract\`). All constructor parameters
 * are \`readonly\` and baked into the locking script at deploy time.
 *
 * @param owner     - Owner's compressed public key (33 bytes). Only the
 *                    corresponding private key can produce a valid \`sig\`.
 * @param recipient - Recipient address hash (20 bytes, hash160 of pubkey).
 * @param minAmount - Exact satoshi value the spending transaction must
 *                    include in its output, enforced by the covenant rule.
 */
class CovenantVault extends SmartContract {
  /** Owner's compressed ECDSA public key (33 bytes). */
  readonly owner: PubKey;
  /** Recipient address (20-byte hash160 of the recipient's public key). */
  readonly recipient: Addr;
  /** Exact output amount in satoshis enforced by the covenant. */
  readonly minAmount: bigint;

  constructor(owner: PubKey, recipient: Addr, minAmount: bigint) {
    super(owner, recipient, minAmount);
    this.owner = owner;
    this.recipient = recipient;
    this.minAmount = minAmount;
  }

  /**
   * Spend funds held by this covenant.
   *
   * Enforces that the spending transaction creates exactly one P2PKH output
   * to the designated recipient with exactly \`minAmount\` satoshis. The
   * expected output is constructed on-chain and its hash is verified against
   * the sighash preimage's hashOutputs field, which commits to all outputs.
   * This means the transaction must have this single exact output — no
   * additional outputs or different amounts are permitted.
   *
   * @param sig        - ECDSA signature from the owner (~72 bytes DER).
   * @param txPreimage - Sighash preimage (variable length) used by
   *                     \`checkPreimage\` to verify the spending transaction.
   */
  public spend(sig: Sig, txPreimage: SigHashPreimage) {
    assert(checkSig(sig, this.owner));
    assert(checkPreimage(txPreimage));

    // Construct the expected P2PKH output on-chain:
    // <8-byte LE amount> <varint(25)> <OP_DUP OP_HASH160 OP_PUSH(20) recipient OP_EQUALVERIFY OP_CHECKSIG>
    const p2pkhScript = cat(cat('1976a914', this.recipient), '88ac');
    const expectedOutput = cat(num2bin(this.minAmount, 8n), p2pkhScript);

    // Verify the transaction's outputs match exactly
    assert(hash256(expectedOutput) === extractOutputHash(txPreimage));
  }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      recipient: BOB.pubKeyHash,
      minAmount: 1000n,
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'Bitcoin covenant: enforces output destination and amount at the consensus level.',
  },
  {
    id: 'sol-covenant-vault',
    name: 'Covenant Vault (Solidity)',
    language: 'solidity',
    source: `// SPDX-License-Identifier: MIT
pragma runar ^0.1.0;

/// @title CovenantVault
/// @notice A stateless Bitcoin covenant contract.
///
/// A covenant is a self-enforcing spending constraint: the locking script
/// dictates not just *who* can spend the funds, but *how* they may be spent.
/// This contract demonstrates the pattern by combining three verification
/// layers in its single public method:
///
///   1. Owner authorization  -- the owner's ECDSA signature must be valid
///      (proves who is spending).
///   2. Preimage verification -- checkPreimage (OP_PUSH_TX) proves the
///      contract is inspecting the real spending transaction, enabling
///      on-chain introspection of its fields.
///   3. Covenant rule -- the contract constructs the expected P2PKH output
///      on-chain (recipient address + minAmount satoshis) and verifies its
///      hash against the transaction's hashOutputs field. This constrains
///      both the destination and the amount at the consensus level.
///
/// Script layout (simplified):
///   Unlocking: <opPushTxSig> <sig> <txPreimage>
///   Locking:   <pubKey> OP_CHECKSIG OP_VERIFY <checkPreimage>
///              <buildP2PKH(recipient)> <num2bin(minAmount,8)> OP_CAT
///              OP_HASH256 <extractOutputHash(preimage)> OP_EQUAL OP_VERIFY
///
/// Use cases for this pattern include withdrawal limits, time-locked vaults,
/// rate-limited spending, and enforced change addresses.
///
/// Contract model: Stateless (SmartContract). All constructor parameters
/// are immutable and baked into the locking script at deploy time.
contract CovenantVault is SmartContract {
    /// @notice Owner's compressed ECDSA public key (33 bytes).
    PubKey immutable owner;
    /// @notice Recipient address (20-byte hash160 of the recipient's pubkey).
    Addr immutable recipient;
    /// @notice Minimum output amount in satoshis enforced by the covenant.
    bigint immutable minAmount;

    /// @param _owner     Owner's compressed ECDSA public key (33 bytes).
    /// @param _recipient Recipient address hash (20 bytes).
    /// @param _minAmount Minimum output satoshis enforced by the covenant.
    constructor(PubKey _owner, Addr _recipient, bigint _minAmount) {
        owner = _owner;
        recipient = _recipient;
        minAmount = _minAmount;
    }

    /// @notice Spend funds held by this covenant.
    /// @dev Constructs the expected P2PKH output on-chain and verifies it against
    /// the transaction's hashOutputs from the sighash preimage.
    /// @param sig        ECDSA signature from the owner (~72 bytes DER).
    /// @param txPreimage Sighash preimage (variable length) for checkPreimage.
    function spend(Sig sig, SigHashPreimage txPreimage) public {
        require(checkSig(sig, this.owner));
        require(checkPreimage(txPreimage));

        // Construct expected P2PKH output and verify against hashOutputs
        ByteString p2pkhScript = cat(cat(0x1976a914, this.recipient), 0x88ac);
        ByteString expectedOutput = cat(num2bin(this.minAmount, 8), p2pkhScript);
        require(hash256(expectedOutput) == extractOutputHash(txPreimage));
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      recipient: BOB.pubKeyHash,
      minAmount: 1000n,
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'Bitcoin covenant: enforces output destination and amount at the consensus level.',
  },
  {
    id: 'move-covenant-vault',
    name: 'Covenant Vault (Move)',
    language: 'move',
    source: `// CovenantVault -- a stateless Bitcoin covenant contract.
//
// A covenant is a self-enforcing spending constraint: the locking script
// dictates not just *who* can spend the funds, but *how* they may be spent.
// This contract demonstrates the pattern by combining three verification
// layers in its single public method:
//
//   1. Owner authorization  -- the owner's ECDSA signature must be valid
//      (proves who is spending).
//   2. Preimage verification -- check_preimage (OP_PUSH_TX) proves the
//      contract is inspecting the real spending transaction, enabling
//      on-chain introspection of its fields.
//   3. Covenant rule -- the contract constructs the expected P2PKH output
//      on-chain (recipient address + min_amount satoshis) and verifies its
//      hash against the transaction's hashOutputs field. This constrains
//      both the destination and the amount at the consensus level.
//
// Script layout (simplified):
//   Unlocking: <opPushTxSig> <sig> <txPreimage>
//   Locking:   <pubKey> OP_CHECKSIG OP_VERIFY <checkPreimage>
//              <buildP2PKH(recipient)> <num2bin(minAmount,8)> OP_CAT
//              OP_HASH256 <extractOutputHash(preimage)> OP_EQUAL OP_VERIFY
//
// Use cases for this pattern include withdrawal limits, time-locked vaults,
// rate-limited spending, and enforced change addresses.
//
// Contract model: Stateless (SmartContract). All fields are readonly and
// baked into the locking script at deploy time.
module CovenantVault {
    use runar::types::{PubKey, Sig, Addr, ByteString, SigHashPreimage};
    use runar::crypto::{check_sig, check_preimage, extract_output_hash, hash256, num2bin, cat};

    // Vault state: all fields are readonly constructor parameters.
    //   owner      -- compressed ECDSA public key (33 bytes).
    //   recipient  -- address hash (20-byte hash160 of the recipient's pubkey).
    //   min_amount -- minimum output satoshis enforced by the covenant.
    struct CovenantVault {
        owner: PubKey,
        recipient: Addr,
        min_amount: bigint,
    }

    // Spend funds held by this covenant.
    //
    // Constructs the expected P2PKH output on-chain and verifies it against
    // the transaction's hashOutputs from the sighash preimage.
    //
    // Parameters:
    //   sig          -- ECDSA signature from the owner (~72 bytes DER).
    //   tx_preimage  -- sighash preimage (variable length) for check_preimage.
    public fun spend(contract: &CovenantVault, sig: Sig, tx_preimage: SigHashPreimage) {
        assert!(check_sig(sig, contract.owner), 0);
        assert!(check_preimage(tx_preimage), 0);

        // Construct expected P2PKH output and verify against hashOutputs
        let p2pkh_script: ByteString = cat(cat(0x1976a914, contract.recipient), 0x88ac);
        let expected_output: ByteString = cat(num2bin(contract.min_amount, 8), p2pkh_script);
        assert!(hash256(expected_output) == extract_output_hash(tx_preimage), 0);
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      recipient: BOB.pubKeyHash,
      minAmount: 1000n,
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'Bitcoin covenant: enforces output destination and amount at the consensus level.',
  },
  {
    id: 'go-covenant-vault',
    name: 'Covenant Vault (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// CovenantVault is a stateless Bitcoin covenant contract.
//
// A covenant is a self-enforcing spending constraint: the locking script
// dictates not just who can spend the funds, but how they may be spent.
// This contract demonstrates the pattern by combining three verification
// layers in its single public method:
//
//  1. Owner authorization  -- the owner's ECDSA signature must be valid
//     (proves who is spending).
//  2. Preimage verification -- CheckPreimage (OP_PUSH_TX) proves the
//     contract is inspecting the real spending transaction, enabling
//     on-chain introspection of its fields.
//  3. Covenant rule -- the contract constructs the expected P2PKH output
//     on-chain (recipient address + MinAmount satoshis) and verifies its
//     hash against the transaction's hashOutputs field. This constrains
//     both the destination and the amount at the consensus level.
//
// Script layout (simplified):
//
//	Unlocking: <opPushTxSig> <sig> <txPreimage>
//	Locking:   <pubKey> OP_CHECKSIG OP_VERIFY <checkPreimage>
//	           <buildP2PKH(recipient)> <num2bin(minAmount,8)> OP_CAT
//	           OP_HASH256 <extractOutputHash(preimage)> OP_EQUAL OP_VERIFY
//
// Use cases for this pattern include withdrawal limits, time-locked vaults,
// rate-limited spending, and enforced change addresses.
//
// Contract model: Stateless (SmartContract). All constructor parameters
// are readonly and baked into the locking script at deploy time.
type CovenantVault struct {
	runar.SmartContract
	// Owner is the compressed ECDSA public key (33 bytes) of the vault owner.
	// Only the corresponding private key can produce a valid signature.
	Owner runar.PubKey \`runar:"readonly"\`
	// Recipient is the address hash (20 bytes, hash160 of pubkey) of the
	// intended recipient.
	Recipient runar.Addr \`runar:"readonly"\`
	// MinAmount is the minimum output amount in satoshis enforced by the
	// covenant rule.
	MinAmount runar.Bigint \`runar:"readonly"\`
}

// Spend unlocks funds held by this covenant. Constructs the expected P2PKH
// output on-chain and verifies it against the transaction's hashOutputs.
//
// Parameters:
//   - sig:        ECDSA signature from the owner (~72 bytes DER).
//   - txPreimage: Sighash preimage (variable length) used by CheckPreimage.
func (c *CovenantVault) Spend(sig runar.Sig, txPreimage runar.SigHashPreimage) {
	runar.Assert(runar.CheckSig(sig, c.Owner))
	runar.Assert(runar.CheckPreimage(txPreimage))

	// Construct expected P2PKH output and verify against hashOutputs
	p2pkhScript := runar.Cat(runar.Cat("1976a914", c.Recipient), "88ac")
	expectedOutput := runar.Cat(runar.Num2Bin(c.MinAmount, 8), p2pkhScript)
	runar.Assert(runar.Hash256(expectedOutput) == runar.ExtractOutputHash(txPreimage))
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      recipient: BOB.pubKeyHash,
      minAmount: 1000n,
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'Bitcoin covenant: enforces output destination and amount at the consensus level.',
  },
  {
    id: 'rust-covenant-vault',
    name: 'Covenant Vault (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// A stateless Bitcoin covenant contract.
///
/// A covenant is a self-enforcing spending constraint: the locking script
/// dictates not just *who* can spend the funds, but *how* they may be spent.
/// This contract demonstrates the pattern by combining three verification
/// layers in its single public method:
///
/// 1. **Owner authorization** -- the owner's ECDSA signature must be valid
///    (proves who is spending).
/// 2. **Preimage verification** -- \`check_preimage\` (OP_PUSH_TX) proves the
///    contract is inspecting the real spending transaction, enabling
///    on-chain introspection of its fields.
/// 3. **Covenant rule** -- the contract constructs the expected P2PKH output
///    on-chain (recipient address + \`min_amount\` satoshis) and verifies its
///    hash against the transaction's \`hashOutputs\` field. This constrains
///    both the destination and the amount at the consensus level.
///
/// Script layout (simplified):
/// \`\`\`text
/// Unlocking: <opPushTxSig> <sig> <txPreimage>
/// Locking:   <pubKey> OP_CHECKSIG OP_VERIFY <checkPreimage>
///            <buildP2PKH(recipient)> <num2bin(minAmount,8)> OP_CAT
///            OP_HASH256 <extractOutputHash(preimage)> OP_EQUAL OP_VERIFY
/// \`\`\`
///
/// Use cases for this pattern include withdrawal limits, time-locked vaults,
/// rate-limited spending, and enforced change addresses.
///
/// Contract model: Stateless (\`SmartContract\`). All constructor parameters
/// are readonly and baked into the locking script at deploy time.
#[runar::contract]
pub struct CovenantVault {
    /// Owner's compressed ECDSA public key (33 bytes).
    #[readonly]
    pub owner: PubKey,
    /// Recipient address (20-byte hash160 of the recipient's public key).
    #[readonly]
    pub recipient: Addr,
    /// Minimum output amount in satoshis enforced by the covenant.
    #[readonly]
    pub min_amount: Bigint,
}

#[runar::methods(CovenantVault)]
impl CovenantVault {
    /// Spend funds held by this covenant.
    ///
    /// Constructs the expected P2PKH output on-chain and verifies it against
    /// the transaction's hashOutputs from the sighash preimage.
    ///
    /// - \`sig\`         -- ECDSA signature from the owner (~72 bytes DER).
    /// - \`tx_preimage\` -- Sighash preimage for \`check_preimage\` verification.
    #[public]
    pub fn spend(&self, sig: &Sig, tx_preimage: &SigHashPreimage) {
        assert!(check_sig(sig, &self.owner));
        assert!(check_preimage(tx_preimage));

        // Construct expected P2PKH output and verify against hashOutputs
        let script_prefix = cat("1976a914", &self.recipient);
        let p2pkh_script = cat(&script_prefix, "88ac");
        let amount_bytes = num2bin(&self.min_amount, 8);
        let expected_output = cat(&amount_bytes, &p2pkh_script);
        assert!(hash256(&expected_output) == extract_output_hash(tx_preimage));
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      recipient: BOB.pubKeyHash,
      minAmount: 1000n,
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'Bitcoin covenant: enforces output destination and amount at the consensus level.',
  },
  {
    id: 'python-covenant-vault',
    name: 'Covenant Vault (Python)',
    language: 'python',
    source: `"""CovenantVault -- a stateless Bitcoin covenant contract.

A covenant is a self-enforcing spending constraint: the locking script
dictates not just *who* can spend the funds, but *how* they may be spent.
This contract demonstrates the pattern by combining three verification
layers in its single public method:

  1. Owner authorization  -- the owner's ECDSA signature must be valid
     (proves who is spending).
  2. Preimage verification -- check_preimage (OP_PUSH_TX) proves the
     contract is inspecting the real spending transaction, enabling
     on-chain introspection of its fields.
  3. Covenant rule -- the contract constructs the expected P2PKH output
     on-chain (recipient address + min_amount satoshis) and verifies its
     hash against the transaction's hashOutputs field. This constrains
     both the destination and the amount at the consensus level.

Script layout (simplified)::

    Unlocking: <opPushTxSig> <sig> <txPreimage>
    Locking:   <pubKey> OP_CHECKSIG OP_VERIFY <checkPreimage>
               <buildP2PKH(recipient)> <num2bin(minAmount,8)> OP_CAT
               OP_HASH256 <extractOutputHash(preimage)> OP_EQUAL OP_VERIFY

Use cases for this pattern include withdrawal limits, time-locked vaults,
rate-limited spending, and enforced change addresses.

Contract model: Stateless (SmartContract). All constructor parameters
are readonly and baked into the locking script at deploy time.
"""

from runar import (
    SmartContract, PubKey, Sig, Addr, ByteString, SigHashPreimage, Bigint,
    public, assert_, check_sig, check_preimage, extract_output_hash, hash256, num2bin, cat,
)

class CovenantVault(SmartContract):
    """Bitcoin covenant vault with minimum-output enforcement.

    Args:
        owner:      Owner's compressed ECDSA public key (33 bytes).
        recipient:  Recipient address (20-byte hash160 of pubkey).
        min_amount: Minimum output amount in satoshis enforced by the
                    covenant rule.
    """

    owner: PubKey
    recipient: Addr
    min_amount: Bigint

    def __init__(self, owner: PubKey, recipient: Addr, min_amount: Bigint):
        super().__init__(owner, recipient, min_amount)
        self.owner = owner
        self.recipient = recipient
        self.min_amount = min_amount

    @public
    def spend(self, sig: Sig, tx_preimage: SigHashPreimage):
        """Spend funds held by this covenant.

        Constructs the expected P2PKH output on-chain and verifies it against
        the transaction's hashOutputs from the sighash preimage.

        Args:
            sig:         ECDSA signature from the owner (~72 bytes DER).
            tx_preimage: Sighash preimage for check_preimage verification.
        """
        assert_(check_sig(sig, self.owner))
        assert_(check_preimage(tx_preimage))

        # Construct expected P2PKH output and verify against hashOutputs
        p2pkh_script = cat(cat('1976a914', self.recipient), '88ac')
        expected_output = cat(num2bin(self.min_amount, 8), p2pkh_script)
        assert_(hash256(expected_output) == extract_output_hash(tx_preimage))
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      recipient: BOB.pubKeyHash,
      minAmount: 1000n,
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'Bitcoin covenant: enforces output destination and amount at the consensus level.',
  },
  {
    id: 'zig-covenant-vault',
    name: 'Covenant Vault (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const CovenantVault = struct {
    pub const Contract = runar.SmartContract;

    owner: runar.PubKey,
    recipient: runar.Addr,
    minAmount: i64,

    pub fn init(owner: runar.PubKey, recipient: runar.Addr, minAmount: i64) CovenantVault {
        return .{
            .owner = owner,
            .recipient = recipient,
            .minAmount = minAmount,
        };
    }

    pub fn spend(self: *const CovenantVault, sig: runar.Sig, txPreimage: runar.SigHashPreimage) void {
        runar.assert(runar.checkSig(sig, self.owner));
        runar.assert(runar.checkPreimage(txPreimage));

        const expectedOutput = runar.buildChangeOutput(self.recipient, self.minAmount);

        runar.assert(runar.bytesEq(runar.hash256(expectedOutput), runar.extractOutputHash(txPreimage)));
    }
};
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      recipient: BOB.pubKeyHash,
      minAmount: 1000n,
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'Bitcoin covenant: enforces output destination and amount at the consensus level.',
  },
  {
    id: 'ruby-covenant-vault',
    name: 'Covenant Vault (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class CovenantVault < Runar::SmartContract
  prop :owner, PubKey
  prop :recipient, Addr
  prop :min_amount, Bigint

  def initialize(owner, recipient, min_amount)
    super(owner, recipient, min_amount)
    @owner = owner
    @recipient = recipient
    @min_amount = min_amount
  end

  runar_public sig: Sig, tx_preimage: SigHashPreimage
  def spend(sig, tx_preimage)
    assert check_sig(sig, @owner)
    assert check_preimage(tx_preimage)
    p2pkh_script = cat(cat('1976a914', @recipient), '88ac')
    expected_output = cat(num2bin(@min_amount, 8), p2pkh_script)
    assert hash256(expected_output) == extract_output_hash(tx_preimage)
  end
end
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      recipient: BOB.pubKeyHash,
      minAmount: 1000n,
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'ByteString', value: '00' },
      ],
    },
    description: 'Bitcoin covenant: enforces output destination and amount at the consensus level.',
  },
  {
    id: 'ec-demo',
    name: 'EC Primitives Demo',
    language: 'typescript',
    source: `import {
  SmartContract, assert,
  ecAdd, ecMul, ecMulGen, ecNegate, ecOnCurve, ecModReduce,
  ecEncodeCompressed, ecMakePoint, ecPointX, ecPointY,
  EC_N,
} from 'runar-lang';
import type { Point, ByteString } from 'runar-lang';

/**
 * ECDemo — A stateless contract demonstrating every built-in elliptic curve
 * primitive available in Runar.
 *
 * Runar provides 10 built-in functions for secp256k1 elliptic curve arithmetic.
 * These compile into Bitcoin Script opcodes that perform real EC math on-chain,
 * enabling advanced cryptographic protocols like Schnorr signatures, zero-knowledge
 * proofs, and key derivation — all enforced by the Bitcoin network.
 *
 * **Curve: secp256k1**
 * - Field prime p = 2^256 - 2^32 - 977
 * - Group order n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
 * - Generator point G is a fixed curve point; \`ecMulGen(k)\` computes k*G
 * - Points are 64 bytes: x[32] || y[32], big-endian unsigned, no prefix byte
 *
 * **How EC operations compile to Bitcoin Script:**
 * Each EC function expands into a sequence of stack operations during compilation.
 * For example, \`ecMul\` compiles to a 256-iteration double-and-add loop using
 * Jacobian coordinates — roughly 1,500 bytes of Script. \`ecAdd\` uses affine
 * addition with modular inverses — roughly 800 bytes. The compiler handles all
 * coordinate math automatically; the developer works with high-level point
 * operations.
 *
 * **The 10 EC primitives:**
 * 1. \`ecPointX(p)\` — Extract x-coordinate from a point
 * 2. \`ecPointY(p)\` — Extract y-coordinate from a point
 * 3. \`ecMakePoint(x, y)\` — Construct a point from coordinates
 * 4. \`ecOnCurve(p)\` — Check if a point lies on the curve
 * 5. \`ecAdd(a, b)\` — Add two curve points
 * 6. \`ecMul(p, k)\` — Scalar multiplication: k * P
 * 7. \`ecMulGen(k)\` — Generator multiplication: k * G (optimized)
 * 8. \`ecNegate(p)\` — Negate a point: (x, p - y)
 * 9. \`ecModReduce(v, m)\` — Modular reduction for group arithmetic
 * 10. \`ecEncodeCompressed(p)\` — Compress to 33-byte public key format
 *
 * This contract is stateless (\`SmartContract\`), so each method is an independent
 * spending condition. No signature checks are performed — the focus is purely on
 * demonstrating EC operations.
 */
class ECDemo extends SmartContract {
  /** A curve point stored as a contract property. Used as input to most methods. */
  readonly pt: Point;

  constructor(pt: Point) {
    super(pt);
    this.pt = pt;
  }

  // -------------------------------------------------------------------
  // Coordinate extraction and construction
  // -------------------------------------------------------------------

  /**
   * Extract the x-coordinate from the stored point and verify it matches
   * the expected value.
   *
   * \`ecPointX\` splits a 64-byte Point into its first 32 bytes (big-endian
   * unsigned x-coordinate) and converts to a script number.
   *
   * Use cases: comparing public key x-coordinates, Schnorr signature
   * verification (which only uses the x-coordinate).
   */
  public checkX(expectedX: bigint) {
    assert(ecPointX(this.pt) === expectedX);
  }

  /**
   * Extract the y-coordinate from the stored point and verify it matches
   * the expected value.
   *
   * \`ecPointY\` splits a 64-byte Point into its last 32 bytes (big-endian
   * unsigned y-coordinate) and converts to a script number.
   *
   * Use cases: full point comparison, parity checks for compressed encoding.
   */
  public checkY(expectedY: bigint) {
    assert(ecPointY(this.pt) === expectedY);
  }

  /**
   * Construct a point from x and y coordinates, then verify the result
   * matches the expected coordinates.
   *
   * \`ecMakePoint(x, y)\` encodes each coordinate as a 32-byte big-endian
   * unsigned integer and concatenates them into a 64-byte Point.
   *
   * Use cases: reconstructing points from stored coordinates, building
   * points from external data.
   */
  public checkMakePoint(x: bigint, y: bigint, expectedX: bigint, expectedY: bigint) {
    const p = ecMakePoint(x, y);
    assert(ecPointX(p) === expectedX);
    assert(ecPointY(p) === expectedY);
  }

  // -------------------------------------------------------------------
  // Curve membership
  // -------------------------------------------------------------------

  /**
   * Verify the stored point lies on the secp256k1 curve.
   *
   * \`ecOnCurve(p)\` checks the curve equation: y^2 === x^3 + 7 (mod p).
   * Returns true if the point satisfies the equation, false otherwise.
   *
   * Use cases: validating untrusted points from transaction inputs before
   * performing EC arithmetic (prevents invalid-curve attacks).
   */
  public checkOnCurve() {
    assert(ecOnCurve(this.pt));
  }

  // -------------------------------------------------------------------
  // Point arithmetic
  // -------------------------------------------------------------------

  /**
   * Add two curve points and verify the result.
   *
   * \`ecAdd(a, b)\` performs elliptic curve point addition using the affine
   * addition formula:
   *   lambda = (y2 - y1) / (x2 - x1) mod p
   *   x3 = lambda^2 - x1 - x2 mod p
   *   y3 = lambda(x1 - x3) - y1 mod p
   *
   * This compiles to ~800 bytes of Bitcoin Script including a modular
   * inverse computation.
   *
   * Use cases: combining public keys (key aggregation), Schnorr multi-sig,
   * Pedersen commitments (C = v*G + r*H).
   */
  public checkAdd(other: Point, expectedX: bigint, expectedY: bigint) {
    const result = ecAdd(this.pt, other);
    assert(ecPointX(result) === expectedX);
    assert(ecPointY(result) === expectedY);
  }

  /**
   * Multiply the stored point by a scalar and verify the result.
   *
   * \`ecMul(p, k)\` computes k * P using a 256-bit double-and-add algorithm
   * in Jacobian coordinates (to avoid per-step modular inverses). The final
   * result is converted back to affine coordinates.
   *
   * This is the most expensive EC operation: ~1,500 bytes of Bitcoin Script
   * with a 256-iteration loop.
   *
   * Use cases: public key derivation (P = k*G), Diffie-Hellman shared
   * secrets, BIP-32 child key derivation.
   */
  public checkMul(scalar: bigint, expectedX: bigint, expectedY: bigint) {
    const result = ecMul(this.pt, scalar);
    assert(ecPointX(result) === expectedX);
    assert(ecPointY(result) === expectedY);
  }

  /**
   * Multiply the generator point G by a scalar and verify the result.
   *
   * \`ecMulGen(k)\` is equivalent to \`ecMul(EC_G, k)\` but the generator
   * point is hardcoded into the compiled script, saving the overhead of
   * pushing 64 bytes of point data.
   *
   * Use cases: deriving a public key from a private key (the fundamental
   * operation in elliptic curve cryptography), generating nonce points
   * for Schnorr proofs (R = r*G).
   */
  public checkMulGen(scalar: bigint, expectedX: bigint, expectedY: bigint) {
    const result = ecMulGen(scalar);
    assert(ecPointX(result) === expectedX);
    assert(ecPointY(result) === expectedY);
  }

  // -------------------------------------------------------------------
  // Point negation
  // -------------------------------------------------------------------

  /**
   * Negate the stored point and verify the result's y-coordinate.
   *
   * \`ecNegate(p)\` returns the point (x, field_prime - y). This is the
   * additive inverse: P + (-P) = point at infinity.
   *
   * Use cases: subtraction of points (A - B = A + (-B)), cancellation
   * checks in zero-knowledge proofs.
   */
  public checkNegate(expectedNegY: bigint) {
    const neg = ecNegate(this.pt);
    assert(ecPointY(neg) === expectedNegY);
  }

  /**
   * Verify that negating a point twice returns the original point.
   *
   * This demonstrates the involution property: -(-P) = P. Double negation
   * is a no-op, which the compiler can optimize away at the ANF level.
   */
  public checkNegateRoundtrip() {
    const neg1 = ecNegate(this.pt);
    const neg2 = ecNegate(neg1);
    assert(ecPointX(neg2) === ecPointX(this.pt));
    assert(ecPointY(neg2) === ecPointY(this.pt));
  }

  // -------------------------------------------------------------------
  // Modular arithmetic
  // -------------------------------------------------------------------

  /**
   * Perform modular reduction and verify the result.
   *
   * \`ecModReduce(value, mod)\` computes \`((value % mod) + mod) % mod\`,
   * ensuring the result is always non-negative. This is essential for
   * EC group arithmetic where scalars must be in [0, n-1].
   *
   * Use cases: reducing Schnorr response values mod n, ensuring private
   * key scalars are in the valid range, hash-to-scalar conversion.
   */
  public checkModReduce(value: bigint, modulus: bigint, expected: bigint) {
    assert(ecModReduce(value, modulus) === expected);
  }

  // -------------------------------------------------------------------
  // Compressed encoding
  // -------------------------------------------------------------------

  /**
   * Compress the stored point to 33-byte public key format and verify.
   *
   * \`ecEncodeCompressed(p)\` produces a 33-byte encoding: a prefix byte
   * (0x02 if y is even, 0x03 if y is odd) followed by the 32-byte
   * x-coordinate. This is the standard Bitcoin compressed public key format.
   *
   * Use cases: generating public key hashes for P2PKH addresses, comparing
   * computed keys against stored key hashes, interoperating with standard
   * Bitcoin tooling.
   */
  public checkEncodeCompressed(expected: ByteString) {
    const compressed = ecEncodeCompressed(this.pt);
    assert(compressed === expected);
  }

  // -------------------------------------------------------------------
  // Algebraic properties
  // -------------------------------------------------------------------

  /**
   * Verify that scalar multiplication by 1 is the identity operation.
   *
   * For any point P: 1 * P = P. This is a fundamental algebraic property
   * and a useful sanity check that ecMul handles the identity scalar.
   */
  public checkMulIdentity() {
    const result = ecMul(this.pt, 1n);
    assert(ecPointX(result) === ecPointX(this.pt));
    assert(ecPointY(result) === ecPointY(this.pt));
  }

  /**
   * Verify that the result of ecAdd lies on the curve.
   *
   * Closure property: if A and B are on the curve, then A + B is also on
   * the curve. This is guaranteed by the group law but serves as a
   * correctness check for the EC addition implementation.
   */
  public checkAddOnCurve(other: Point) {
    const result = ecAdd(this.pt, other);
    assert(ecOnCurve(result));
  }

  /**
   * Verify that a generator multiplication result lies on the curve.
   *
   * For any scalar k, k * G must be a valid curve point. This tests the
   * ecMulGen implementation produces points satisfying the curve equation.
   */
  public checkMulGenOnCurve(scalar: bigint) {
    const result = ecMulGen(scalar);
    assert(ecOnCurve(result));
  }
}
`,
    constructorArgs: {
      pt: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'checkOnCurve',
      args: [],
    },
    description: 'Demonstrates all 10 secp256k1 elliptic curve primitives available in Runar.',
  },
  {
    id: 'sol-ec-demo',
    name: 'EC Primitives Demo (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title ECDemo
/// @notice A stateless contract demonstrating every built-in elliptic curve
/// primitive available in Runar.
/// @dev Runar provides 10 built-in functions for secp256k1 elliptic curve
/// arithmetic. These compile into Bitcoin Script opcodes that perform real
/// EC math on-chain, enabling advanced cryptographic protocols like Schnorr
/// signatures, zero-knowledge proofs, and key derivation — all enforced by
/// the Bitcoin network.
///
/// Curve: secp256k1
///   Field prime p = 2^256 - 2^32 - 977
///   Group order n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
///   Generator point G is a fixed curve point; ecMulGen(k) computes k*G
///   Points are 64 bytes: x[32] || y[32], big-endian unsigned, no prefix byte
///
/// The 10 EC primitives:
///   ecPointX, ecPointY, ecMakePoint, ecOnCurve, ecAdd,
///   ecMul, ecMulGen, ecNegate, ecModReduce, ecEncodeCompressed
///
/// This contract is stateless (SmartContract), so each method is an
/// independent spending condition. No signature checks are performed.
contract ECDemo is SmartContract {
    Point immutable pt;

    constructor(Point _pt) {
        pt = _pt;
    }

    /// @notice Extract the x-coordinate from the stored point and verify it
    /// matches the expected value.
    /// @param expectedX The expected x-coordinate
    function checkX(bigint expectedX) public {
        require(ecPointX(this.pt) == expectedX);
    }

    /// @notice Extract the y-coordinate from the stored point and verify it
    /// matches the expected value.
    /// @param expectedY The expected y-coordinate
    function checkY(bigint expectedY) public {
        require(ecPointY(this.pt) == expectedY);
    }

    /// @notice Construct a point from x and y coordinates, then verify the
    /// result matches the expected coordinates.
    /// @param x The x-coordinate
    /// @param y The y-coordinate
    /// @param expectedX The expected x-coordinate of the constructed point
    /// @param expectedY The expected y-coordinate of the constructed point
    function checkMakePoint(bigint x, bigint y, bigint expectedX, bigint expectedY) public {
        Point p = ecMakePoint(x, y);
        require(ecPointX(p) == expectedX);
        require(ecPointY(p) == expectedY);
    }

    /// @notice Verify the stored point lies on the secp256k1 curve.
    /// @dev Checks y^2 === x^3 + 7 (mod p).
    function checkOnCurve() public {
        require(ecOnCurve(this.pt));
    }

    /// @notice Add two curve points and verify the result.
    /// @param other The second point to add
    /// @param expectedX The expected x-coordinate of the sum
    /// @param expectedY The expected y-coordinate of the sum
    function checkAdd(Point other, bigint expectedX, bigint expectedY) public {
        Point result = ecAdd(this.pt, other);
        require(ecPointX(result) == expectedX);
        require(ecPointY(result) == expectedY);
    }

    /// @notice Multiply the stored point by a scalar and verify the result.
    /// @param scalar The scalar multiplier
    /// @param expectedX The expected x-coordinate of the product
    /// @param expectedY The expected y-coordinate of the product
    function checkMul(bigint scalar, bigint expectedX, bigint expectedY) public {
        Point result = ecMul(this.pt, scalar);
        require(ecPointX(result) == expectedX);
        require(ecPointY(result) == expectedY);
    }

    /// @notice Multiply the generator point G by a scalar and verify the result.
    /// @param scalar The scalar multiplier
    /// @param expectedX The expected x-coordinate
    /// @param expectedY The expected y-coordinate
    function checkMulGen(bigint scalar, bigint expectedX, bigint expectedY) public {
        Point result = ecMulGen(scalar);
        require(ecPointX(result) == expectedX);
        require(ecPointY(result) == expectedY);
    }

    /// @notice Negate the stored point and verify the result's y-coordinate.
    /// @param expectedNegY The expected y-coordinate of the negated point
    function checkNegate(bigint expectedNegY) public {
        Point neg = ecNegate(this.pt);
        require(ecPointY(neg) == expectedNegY);
    }

    /// @notice Verify that negating a point twice returns the original point.
    /// @dev Demonstrates the involution property: -(-P) = P.
    function checkNegateRoundtrip() public {
        Point neg1 = ecNegate(this.pt);
        Point neg2 = ecNegate(neg1);
        require(ecPointX(neg2) == ecPointX(this.pt));
        require(ecPointY(neg2) == ecPointY(this.pt));
    }

    /// @notice Perform modular reduction and verify the result.
    /// @param value The value to reduce
    /// @param modulus The modulus
    /// @param expected The expected result
    function checkModReduce(bigint value, bigint modulus, bigint expected) public {
        require(ecModReduce(value, modulus) == expected);
    }

    /// @notice Compress the stored point to 33-byte public key format and verify.
    /// @param expected The expected compressed encoding
    function checkEncodeCompressed(ByteString expected) public {
        ByteString compressed = ecEncodeCompressed(this.pt);
        require(compressed == expected);
    }

    /// @notice Verify that scalar multiplication by 1 is the identity operation.
    /// @dev For any point P: 1 * P = P.
    function checkMulIdentity() public {
        Point result = ecMul(this.pt, 1);
        require(ecPointX(result) == ecPointX(this.pt));
        require(ecPointY(result) == ecPointY(this.pt));
    }

    /// @notice Verify that the result of ecAdd lies on the curve.
    /// @param other The second point to add
    function checkAddOnCurve(Point other) public {
        Point result = ecAdd(this.pt, other);
        require(ecOnCurve(result));
    }

    /// @notice Verify that a generator multiplication result lies on the curve.
    /// @param scalar The scalar multiplier
    function checkMulGenOnCurve(bigint scalar) public {
        Point result = ecMulGen(scalar);
        require(ecOnCurve(result));
    }
}
`,
    constructorArgs: {
      pt: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'checkOnCurve',
      args: [],
    },
    description: 'Demonstrates all 10 secp256k1 elliptic curve primitives available in Runar.',
  },
  {
    id: 'move-ec-demo',
    name: 'EC Primitives Demo (Move)',
    language: 'move',
    source: `// ECDemo — A stateless contract demonstrating every built-in elliptic curve
// primitive available in Runar.
//
// Runar provides 10 built-in functions for secp256k1 elliptic curve
// arithmetic. These compile into Bitcoin Script opcodes that perform real
// EC math on-chain, enabling advanced cryptographic protocols like Schnorr
// signatures, zero-knowledge proofs, and key derivation — all enforced by
// the Bitcoin network.
//
// Curve: secp256k1
//   Field prime p = 2^256 - 2^32 - 977
//   Group order n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
//   Generator point G is a fixed curve point; ecMulGen(k) computes k*G
//   Points are 64 bytes: x[32] || y[32], big-endian unsigned, no prefix byte
//
// The 10 EC primitives:
//   ecPointX, ecPointY, ecMakePoint, ecOnCurve, ecAdd,
//   ecMul, ecMulGen, ecNegate, ecModReduce, ecEncodeCompressed
//
// This contract is stateless (SmartContract), so each method is an
// independent spending condition. No signature checks are performed.
module ECDemo {
    use runar::types::{Point, ByteString};
    use runar::crypto::{ecPointX, ecPointY, ecMakePoint, ecOnCurve, ecAdd, ecMul, ecMulGen, ecNegate, ecModReduce, ecEncodeCompressed};

    resource struct ECDemo {
        pt: Point,
    }

    // Extract the x-coordinate from the stored point and verify it
    // matches the expected value.
    public fun check_x(contract: &ECDemo, expected_x: bigint) {
        assert!(ecPointX(contract.pt) == expected_x, 0);
    }

    // Extract the y-coordinate from the stored point and verify it
    // matches the expected value.
    public fun check_y(contract: &ECDemo, expected_y: bigint) {
        assert!(ecPointY(contract.pt) == expected_y, 0);
    }

    // Construct a point from x and y coordinates, then verify the
    // result matches the expected coordinates.
    public fun check_make_point(contract: &ECDemo, x: bigint, y: bigint, expected_x: bigint, expected_y: bigint) {
        let p: Point = ecMakePoint(x, y);
        assert!(ecPointX(p) == expected_x, 0);
        assert!(ecPointY(p) == expected_y, 0);
    }

    // Verify the stored point lies on the secp256k1 curve.
    // Checks y^2 === x^3 + 7 (mod p).
    public fun check_on_curve(contract: &ECDemo) {
        assert!(ecOnCurve(contract.pt), 0);
    }

    // Add two curve points and verify the result.
    public fun check_add(contract: &ECDemo, other: Point, expected_x: bigint, expected_y: bigint) {
        let result: Point = ecAdd(contract.pt, other);
        assert!(ecPointX(result) == expected_x, 0);
        assert!(ecPointY(result) == expected_y, 0);
    }

    // Multiply the stored point by a scalar and verify the result.
    public fun check_mul(contract: &ECDemo, scalar: bigint, expected_x: bigint, expected_y: bigint) {
        let result: Point = ecMul(contract.pt, scalar);
        assert!(ecPointX(result) == expected_x, 0);
        assert!(ecPointY(result) == expected_y, 0);
    }

    // Multiply the generator point G by a scalar and verify the result.
    public fun check_mul_gen(contract: &ECDemo, scalar: bigint, expected_x: bigint, expected_y: bigint) {
        let result: Point = ecMulGen(scalar);
        assert!(ecPointX(result) == expected_x, 0);
        assert!(ecPointY(result) == expected_y, 0);
    }

    // Negate the stored point and verify the result's y-coordinate.
    public fun check_negate(contract: &ECDemo, expected_neg_y: bigint) {
        let neg: Point = ecNegate(contract.pt);
        assert!(ecPointY(neg) == expected_neg_y, 0);
    }

    // Verify that negating a point twice returns the original point.
    // Demonstrates the involution property: -(-P) = P.
    public fun check_negate_roundtrip(contract: &ECDemo) {
        let neg1: Point = ecNegate(contract.pt);
        let neg2: Point = ecNegate(neg1);
        assert!(ecPointX(neg2) == ecPointX(contract.pt), 0);
        assert!(ecPointY(neg2) == ecPointY(contract.pt), 0);
    }

    // Perform modular reduction and verify the result.
    public fun check_mod_reduce(contract: &ECDemo, value: bigint, modulus: bigint, expected: bigint) {
        assert!(ecModReduce(value, modulus) == expected, 0);
    }

    // Compress the stored point to 33-byte public key format and verify.
    public fun check_encode_compressed(contract: &ECDemo, expected: ByteString) {
        let compressed: ByteString = ecEncodeCompressed(contract.pt);
        assert!(compressed == expected, 0);
    }

    // Verify that scalar multiplication by 1 is the identity operation.
    // For any point P: 1 * P = P.
    public fun check_mul_identity(contract: &ECDemo) {
        let result: Point = ecMul(contract.pt, 1);
        assert!(ecPointX(result) == ecPointX(contract.pt), 0);
        assert!(ecPointY(result) == ecPointY(contract.pt), 0);
    }

    // Verify that the result of ecAdd lies on the curve.
    public fun check_add_on_curve(contract: &ECDemo, other: Point) {
        let result: Point = ecAdd(contract.pt, other);
        assert!(ecOnCurve(result), 0);
    }

    // Verify that a generator multiplication result lies on the curve.
    public fun check_mul_gen_on_curve(contract: &ECDemo, scalar: bigint) {
        let result: Point = ecMulGen(scalar);
        assert!(ecOnCurve(result), 0);
    }
}
`,
    constructorArgs: {
      pt: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'checkOnCurve',
      args: [],
    },
    description: 'Demonstrates all 10 secp256k1 elliptic curve primitives available in Runar.',
  },
  {
    id: 'go-ec-demo',
    name: 'EC Primitives Demo (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// ECDemo is a stateless contract demonstrating every built-in elliptic curve
// primitive available in Runar.
//
// Runar provides 10 built-in functions for secp256k1 elliptic curve arithmetic.
// These compile into Bitcoin Script opcodes that perform real EC math on-chain,
// enabling advanced cryptographic protocols like Schnorr signatures, zero-knowledge
// proofs, and key derivation — all enforced by the Bitcoin network.
//
// Curve: secp256k1
//   - Field prime p = 2^256 - 2^32 - 977
//   - Group order n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
//   - Generator point G is a fixed curve point; ecMulGen(k) computes k*G
//   - Points are 64 bytes: x[32] || y[32], big-endian unsigned, no prefix byte
//
// How EC operations compile to Bitcoin Script:
//
// Each EC function expands into a sequence of stack operations during compilation.
// For example, ecMul compiles to a 256-iteration double-and-add loop using
// Jacobian coordinates — roughly 1,500 bytes of Script. ecAdd uses affine
// addition with modular inverses — roughly 800 bytes. The compiler handles all
// coordinate math automatically; the developer works with high-level point
// operations.
//
// The 10 EC primitives:
//  1. ecPointX(p)            — Extract x-coordinate from a point
//  2. ecPointY(p)            — Extract y-coordinate from a point
//  3. ecMakePoint(x, y)      — Construct a point from coordinates
//  4. ecOnCurve(p)           — Check if a point lies on the curve
//  5. ecAdd(a, b)            — Add two curve points
//  6. ecMul(p, k)            — Scalar multiplication: k * P
//  7. ecMulGen(k)            — Generator multiplication: k * G (optimized)
//  8. ecNegate(p)            — Negate a point: (x, p - y)
//  9. ecModReduce(v, m)      — Modular reduction for group arithmetic
//  10. ecEncodeCompressed(p) — Compress to 33-byte public key format
//
// This contract is stateless (SmartContract), so each method is an independent
// spending condition. No signature checks are performed — the focus is purely on
// demonstrating EC operations.
type ECDemo struct {
	runar.SmartContract
	Pt runar.Point \`runar:"readonly"\`
}

// CheckX extracts the x-coordinate from the stored point and verifies it
// matches the expected value.
//
// EcPointX splits a 64-byte Point into its first 32 bytes (big-endian
// unsigned x-coordinate) and converts to a script number.
//
// Use cases: comparing public key x-coordinates, Schnorr signature
// verification (which only uses the x-coordinate).
func (c *ECDemo) CheckX(expectedX runar.Bigint) {
	runar.Assert(runar.EcPointX(c.Pt) == expectedX)
}

// CheckY extracts the y-coordinate from the stored point and verifies it
// matches the expected value.
//
// EcPointY splits a 64-byte Point into its last 32 bytes (big-endian
// unsigned y-coordinate) and converts to a script number.
//
// Use cases: full point comparison, parity checks for compressed encoding.
func (c *ECDemo) CheckY(expectedY runar.Bigint) {
	runar.Assert(runar.EcPointY(c.Pt) == expectedY)
}

// CheckMakePoint constructs a point from x and y coordinates, then verifies
// the result matches the expected coordinates.
//
// EcMakePoint(x, y) encodes each coordinate as a 32-byte big-endian
// unsigned integer and concatenates them into a 64-byte Point.
//
// Use cases: reconstructing points from stored coordinates, building
// points from external data.
func (c *ECDemo) CheckMakePoint(x, y, expectedX, expectedY runar.Bigint) {
	p := runar.EcMakePoint(x, y)
	runar.Assert(runar.EcPointX(p) == expectedX)
	runar.Assert(runar.EcPointY(p) == expectedY)
}

// CheckOnCurve verifies the stored point lies on the secp256k1 curve.
//
// EcOnCurve(p) checks the curve equation: y^2 === x^3 + 7 (mod p).
// Returns true if the point satisfies the equation, false otherwise.
//
// Use cases: validating untrusted points from transaction inputs before
// performing EC arithmetic (prevents invalid-curve attacks).
func (c *ECDemo) CheckOnCurve() {
	runar.Assert(runar.EcOnCurve(c.Pt))
}

// CheckAdd adds two curve points and verifies the result.
//
// EcAdd(a, b) performs elliptic curve point addition using the affine
// addition formula:
//
//	lambda = (y2 - y1) / (x2 - x1) mod p
//	x3 = lambda^2 - x1 - x2 mod p
//	y3 = lambda(x1 - x3) - y1 mod p
//
// This compiles to ~800 bytes of Bitcoin Script including a modular
// inverse computation.
//
// Use cases: combining public keys (key aggregation), Schnorr multi-sig,
// Pedersen commitments (C = v*G + r*H).
func (c *ECDemo) CheckAdd(other runar.Point, expectedX, expectedY runar.Bigint) {
	result := runar.EcAdd(c.Pt, other)
	runar.Assert(runar.EcPointX(result) == expectedX)
	runar.Assert(runar.EcPointY(result) == expectedY)
}

// CheckMul multiplies the stored point by a scalar and verifies the result.
//
// EcMul(p, k) computes k * P using a 256-bit double-and-add algorithm
// in Jacobian coordinates (to avoid per-step modular inverses). The final
// result is converted back to affine coordinates.
//
// This is the most expensive EC operation: ~1,500 bytes of Bitcoin Script
// with a 256-iteration loop.
//
// Use cases: public key derivation (P = k*G), Diffie-Hellman shared
// secrets, BIP-32 child key derivation.
func (c *ECDemo) CheckMul(scalar, expectedX, expectedY runar.Bigint) {
	result := runar.EcMul(c.Pt, scalar)
	runar.Assert(runar.EcPointX(result) == expectedX)
	runar.Assert(runar.EcPointY(result) == expectedY)
}

// CheckMulGen multiplies the generator point G by a scalar and verifies
// the result.
//
// EcMulGen(k) is equivalent to EcMul(EC_G, k) but the generator
// point is hardcoded into the compiled script, saving the overhead of
// pushing 64 bytes of point data.
//
// Use cases: deriving a public key from a private key (the fundamental
// operation in elliptic curve cryptography), generating nonce points
// for Schnorr proofs (R = r*G).
func (c *ECDemo) CheckMulGen(scalar, expectedX, expectedY runar.Bigint) {
	result := runar.EcMulGen(scalar)
	runar.Assert(runar.EcPointX(result) == expectedX)
	runar.Assert(runar.EcPointY(result) == expectedY)
}

// CheckNegate negates the stored point and verifies the result's
// y-coordinate.
//
// EcNegate(p) returns the point (x, field_prime - y). This is the
// additive inverse: P + (-P) = point at infinity.
//
// Use cases: subtraction of points (A - B = A + (-B)), cancellation
// checks in zero-knowledge proofs.
func (c *ECDemo) CheckNegate(expectedNegY runar.Bigint) {
	neg := runar.EcNegate(c.Pt)
	runar.Assert(runar.EcPointY(neg) == expectedNegY)
}

// CheckNegateRoundtrip verifies that negating a point twice returns
// the original point.
//
// This demonstrates the involution property: -(-P) = P. Double negation
// is a no-op, which the compiler can optimize away at the ANF level.
func (c *ECDemo) CheckNegateRoundtrip() {
	neg1 := runar.EcNegate(c.Pt)
	neg2 := runar.EcNegate(neg1)
	runar.Assert(runar.EcPointX(neg2) == runar.EcPointX(c.Pt))
	runar.Assert(runar.EcPointY(neg2) == runar.EcPointY(c.Pt))
}

// CheckModReduce performs modular reduction and verifies the result.
//
// EcModReduce(value, mod) computes ((value % mod) + mod) % mod,
// ensuring the result is always non-negative. This is essential for
// EC group arithmetic where scalars must be in [0, n-1].
//
// Use cases: reducing Schnorr response values mod n, ensuring private
// key scalars are in the valid range, hash-to-scalar conversion.
func (c *ECDemo) CheckModReduce(value, modulus, expected runar.Bigint) {
	runar.Assert(runar.EcModReduce(value, modulus) == expected)
}

// CheckEncodeCompressed compresses the stored point to 33-byte public
// key format and verifies the result.
//
// EcEncodeCompressed(p) produces a 33-byte encoding: a prefix byte
// (0x02 if y is even, 0x03 if y is odd) followed by the 32-byte
// x-coordinate. This is the standard Bitcoin compressed public key format.
//
// Use cases: generating public key hashes for P2PKH addresses, comparing
// computed keys against stored key hashes, interoperating with standard
// Bitcoin tooling.
func (c *ECDemo) CheckEncodeCompressed(expected runar.ByteString) {
	compressed := runar.EcEncodeCompressed(c.Pt)
	runar.Assert(compressed == expected)
}

// CheckMulIdentity verifies that scalar multiplication by 1 is the
// identity operation.
//
// For any point P: 1 * P = P. This is a fundamental algebraic property
// and a useful sanity check that EcMul handles the identity scalar.
func (c *ECDemo) CheckMulIdentity() {
	result := runar.EcMul(c.Pt, 1)
	runar.Assert(runar.EcPointX(result) == runar.EcPointX(c.Pt))
	runar.Assert(runar.EcPointY(result) == runar.EcPointY(c.Pt))
}

// CheckAddOnCurve verifies that the result of EcAdd lies on the curve.
//
// Closure property: if A and B are on the curve, then A + B is also on
// the curve. This is guaranteed by the group law but serves as a
// correctness check for the EC addition implementation.
func (c *ECDemo) CheckAddOnCurve(other runar.Point) {
	result := runar.EcAdd(c.Pt, other)
	runar.Assert(runar.EcOnCurve(result))
}

// CheckMulGenOnCurve verifies that a generator multiplication result
// lies on the curve.
//
// For any scalar k, k * G must be a valid curve point. This tests the
// EcMulGen implementation produces points satisfying the curve equation.
func (c *ECDemo) CheckMulGenOnCurve(scalar runar.Bigint) {
	result := runar.EcMulGen(scalar)
	runar.Assert(runar.EcOnCurve(result))
}
`,
    constructorArgs: {
      pt: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'checkOnCurve',
      args: [],
    },
    description: 'Demonstrates all 10 secp256k1 elliptic curve primitives available in Runar.',
  },
  {
    id: 'rust-ec-demo',
    name: 'EC Primitives Demo (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// ECDemo — A stateless contract demonstrating every built-in elliptic curve
/// primitive available in Runar.
///
/// Runar provides 10 built-in functions for secp256k1 elliptic curve arithmetic.
/// These compile into Bitcoin Script opcodes that perform real EC math on-chain,
/// enabling advanced cryptographic protocols like Schnorr signatures, zero-knowledge
/// proofs, and key derivation — all enforced by the Bitcoin network.
///
/// **Curve: secp256k1**
/// - Field prime p = 2^256 - 2^32 - 977
/// - Group order n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
/// - Generator point G is a fixed curve point; \`ec_mul_gen(k)\` computes k*G
/// - Points are 64 bytes: x[32] || y[32], big-endian unsigned, no prefix byte
///
/// **How EC operations compile to Bitcoin Script:**
/// Each EC function expands into a sequence of stack operations during compilation.
/// For example, \`ec_mul\` compiles to a 256-iteration double-and-add loop using
/// Jacobian coordinates — roughly 1,500 bytes of Script. \`ec_add\` uses affine
/// addition with modular inverses — roughly 800 bytes. The compiler handles all
/// coordinate math automatically; the developer works with high-level point
/// operations.
///
/// **The 10 EC primitives:**
/// 1. \`ec_point_x(p)\` — Extract x-coordinate from a point
/// 2. \`ec_point_y(p)\` — Extract y-coordinate from a point
/// 3. \`ec_make_point(x, y)\` — Construct a point from coordinates
/// 4. \`ec_on_curve(p)\` — Check if a point lies on the curve
/// 5. \`ec_add(a, b)\` — Add two curve points
/// 6. \`ec_mul(p, k)\` — Scalar multiplication: k * P
/// 7. \`ec_mul_gen(k)\` — Generator multiplication: k * G (optimized)
/// 8. \`ec_negate(p)\` — Negate a point: (x, p - y)
/// 9. \`ec_mod_reduce(v, m)\` — Modular reduction for group arithmetic
/// 10. \`ec_encode_compressed(p)\` — Compress to 33-byte public key format
///
/// This contract is stateless (\`SmartContract\`), so each method is an independent
/// spending condition. No signature checks are performed — the focus is purely on
/// demonstrating EC operations.
#[runar::contract]
pub struct ECDemo {
    /// A curve point stored as a contract property. Used as input to most methods.
    #[readonly]
    pub pt: Point,
}

#[runar::methods(ECDemo)]
impl ECDemo {
    // -------------------------------------------------------------------
    // Coordinate extraction and construction
    // -------------------------------------------------------------------

    /// Extract the x-coordinate from the stored point and verify it matches
    /// the expected value.
    ///
    /// \`ec_point_x\` splits a 64-byte Point into its first 32 bytes (big-endian
    /// unsigned x-coordinate) and converts to a script number.
    ///
    /// Use cases: comparing public key x-coordinates, Schnorr signature
    /// verification (which only uses the x-coordinate).
    #[public]
    pub fn check_x(&self, expected_x: Bigint) {
        assert!(ec_point_x(&self.pt) == expected_x);
    }

    /// Extract the y-coordinate from the stored point and verify it matches
    /// the expected value.
    ///
    /// \`ec_point_y\` splits a 64-byte Point into its last 32 bytes (big-endian
    /// unsigned y-coordinate) and converts to a script number.
    ///
    /// Use cases: full point comparison, parity checks for compressed encoding.
    #[public]
    pub fn check_y(&self, expected_y: Bigint) {
        assert!(ec_point_y(&self.pt) == expected_y);
    }

    /// Construct a point from x and y coordinates, then verify the result
    /// matches the expected coordinates.
    ///
    /// \`ec_make_point(x, y)\` encodes each coordinate as a 32-byte big-endian
    /// unsigned integer and concatenates them into a 64-byte Point.
    ///
    /// Use cases: reconstructing points from stored coordinates, building
    /// points from external data.
    #[public]
    pub fn check_make_point(&self, x: Bigint, y: Bigint, expected_x: Bigint, expected_y: Bigint) {
        let p = ec_make_point(x, y);
        assert!(ec_point_x(&p) == expected_x);
        assert!(ec_point_y(&p) == expected_y);
    }

    // -------------------------------------------------------------------
    // Curve membership
    // -------------------------------------------------------------------

    /// Verify the stored point lies on the secp256k1 curve.
    ///
    /// \`ec_on_curve(p)\` checks the curve equation: y^2 === x^3 + 7 (mod p).
    /// Returns true if the point satisfies the equation, false otherwise.
    ///
    /// Use cases: validating untrusted points from transaction inputs before
    /// performing EC arithmetic (prevents invalid-curve attacks).
    #[public]
    pub fn check_on_curve(&self) {
        assert!(ec_on_curve(&self.pt));
    }

    // -------------------------------------------------------------------
    // Point arithmetic
    // -------------------------------------------------------------------

    /// Add two curve points and verify the result.
    ///
    /// \`ec_add(a, b)\` performs elliptic curve point addition using the affine
    /// addition formula:
    ///   lambda = (y2 - y1) / (x2 - x1) mod p
    ///   x3 = lambda^2 - x1 - x2 mod p
    ///   y3 = lambda(x1 - x3) - y1 mod p
    ///
    /// This compiles to ~800 bytes of Bitcoin Script including a modular
    /// inverse computation.
    ///
    /// Use cases: combining public keys (key aggregation), Schnorr multi-sig,
    /// Pedersen commitments (C = v*G + r*H).
    #[public]
    pub fn check_add(&self, other: &Point, expected_x: Bigint, expected_y: Bigint) {
        let result = ec_add(&self.pt, other);
        assert!(ec_point_x(&result) == expected_x);
        assert!(ec_point_y(&result) == expected_y);
    }

    /// Multiply the stored point by a scalar and verify the result.
    ///
    /// \`ec_mul(p, k)\` computes k * P using a 256-bit double-and-add algorithm
    /// in Jacobian coordinates (to avoid per-step modular inverses). The final
    /// result is converted back to affine coordinates.
    ///
    /// This is the most expensive EC operation: ~1,500 bytes of Bitcoin Script
    /// with a 256-iteration loop.
    ///
    /// Use cases: public key derivation (P = k*G), Diffie-Hellman shared
    /// secrets, BIP-32 child key derivation.
    #[public]
    pub fn check_mul(&self, scalar: Bigint, expected_x: Bigint, expected_y: Bigint) {
        let result = ec_mul(&self.pt, scalar);
        assert!(ec_point_x(&result) == expected_x);
        assert!(ec_point_y(&result) == expected_y);
    }

    /// Multiply the generator point G by a scalar and verify the result.
    ///
    /// \`ec_mul_gen(k)\` is equivalent to \`ec_mul(EC_G, k)\` but the generator
    /// point is hardcoded into the compiled script, saving the overhead of
    /// pushing 64 bytes of point data.
    ///
    /// Use cases: deriving a public key from a private key (the fundamental
    /// operation in elliptic curve cryptography), generating nonce points
    /// for Schnorr proofs (R = r*G).
    #[public]
    pub fn check_mul_gen(&self, scalar: Bigint, expected_x: Bigint, expected_y: Bigint) {
        let result = ec_mul_gen(scalar);
        assert!(ec_point_x(&result) == expected_x);
        assert!(ec_point_y(&result) == expected_y);
    }

    // -------------------------------------------------------------------
    // Point negation
    // -------------------------------------------------------------------

    /// Negate the stored point and verify the result's y-coordinate.
    ///
    /// \`ec_negate(p)\` returns the point (x, field_prime - y). This is the
    /// additive inverse: P + (-P) = point at infinity.
    ///
    /// Use cases: subtraction of points (A - B = A + (-B)), cancellation
    /// checks in zero-knowledge proofs.
    #[public]
    pub fn check_negate(&self, expected_neg_y: Bigint) {
        let neg = ec_negate(&self.pt);
        assert!(ec_point_y(&neg) == expected_neg_y);
    }

    /// Verify that negating a point twice returns the original point.
    ///
    /// This demonstrates the involution property: -(-P) = P. Double negation
    /// is a no-op, which the compiler can optimize away at the ANF level.
    #[public]
    pub fn check_negate_roundtrip(&self) {
        let neg1 = ec_negate(&self.pt);
        let neg2 = ec_negate(&neg1);
        assert!(ec_point_x(&neg2) == ec_point_x(&self.pt));
        assert!(ec_point_y(&neg2) == ec_point_y(&self.pt));
    }

    // -------------------------------------------------------------------
    // Modular arithmetic
    // -------------------------------------------------------------------

    /// Perform modular reduction and verify the result.
    ///
    /// \`ec_mod_reduce(value, mod)\` computes \`((value % mod) + mod) % mod\`,
    /// ensuring the result is always non-negative. This is essential for
    /// EC group arithmetic where scalars must be in [0, n-1].
    ///
    /// Use cases: reducing Schnorr response values mod n, ensuring private
    /// key scalars are in the valid range, hash-to-scalar conversion.
    #[public]
    pub fn check_mod_reduce(&self, value: Bigint, modulus: Bigint, expected: Bigint) {
        assert!(ec_mod_reduce(value, modulus) == expected);
    }

    // -------------------------------------------------------------------
    // Compressed encoding
    // -------------------------------------------------------------------

    /// Compress the stored point to 33-byte public key format and verify.
    ///
    /// \`ec_encode_compressed(p)\` produces a 33-byte encoding: a prefix byte
    /// (0x02 if y is even, 0x03 if y is odd) followed by the 32-byte
    /// x-coordinate. This is the standard Bitcoin compressed public key format.
    ///
    /// Use cases: generating public key hashes for P2PKH addresses, comparing
    /// computed keys against stored key hashes, interoperating with standard
    /// Bitcoin tooling.
    #[public]
    pub fn check_encode_compressed(&self, expected: ByteString) {
        let compressed = ec_encode_compressed(&self.pt);
        assert!(compressed == expected);
    }

    // -------------------------------------------------------------------
    // Algebraic properties
    // -------------------------------------------------------------------

    /// Verify that scalar multiplication by 1 is the identity operation.
    ///
    /// For any point P: 1 * P = P. This is a fundamental algebraic property
    /// and a useful sanity check that ec_mul handles the identity scalar.
    #[public]
    pub fn check_mul_identity(&self) {
        let result = ec_mul(&self.pt, 1);
        assert!(ec_point_x(&result) == ec_point_x(&self.pt));
        assert!(ec_point_y(&result) == ec_point_y(&self.pt));
    }

    /// Verify that the result of ec_add lies on the curve.
    ///
    /// Closure property: if A and B are on the curve, then A + B is also on
    /// the curve. This is guaranteed by the group law but serves as a
    /// correctness check for the EC addition implementation.
    #[public]
    pub fn check_add_on_curve(&self, other: &Point) {
        let result = ec_add(&self.pt, other);
        assert!(ec_on_curve(&result));
    }

    /// Verify that a generator multiplication result lies on the curve.
    ///
    /// For any scalar k, k * G must be a valid curve point. This tests the
    /// ec_mul_gen implementation produces points satisfying the curve equation.
    #[public]
    pub fn check_mul_gen_on_curve(&self, scalar: Bigint) {
        let result = ec_mul_gen(scalar);
        assert!(ec_on_curve(&result));
    }
}
`,
    constructorArgs: {
      pt: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'checkOnCurve',
      args: [],
    },
    description: 'Demonstrates all 10 secp256k1 elliptic curve primitives available in Runar.',
  },
  {
    id: 'python-ec-demo',
    name: 'EC Primitives Demo (Python)',
    language: 'python',
    source: `"""ECDemo -- A stateless contract demonstrating every built-in elliptic curve
primitive available in Runar.

Runar provides 10 built-in functions for secp256k1 elliptic curve arithmetic.
These compile into Bitcoin Script opcodes that perform real EC math on-chain,
enabling advanced cryptographic protocols like Schnorr signatures, zero-knowledge
proofs, and key derivation -- all enforced by the Bitcoin network.

Curve: secp256k1
  - Field prime p = 2^256 - 2^32 - 977
  - Group order n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
  - Generator point G is a fixed curve point; ec_mul_gen(k) computes k*G
  - Points are 64 bytes: x[32] || y[32], big-endian unsigned, no prefix byte

How EC operations compile to Bitcoin Script:
  Each EC function expands into a sequence of stack operations during compilation.
  For example, ec_mul compiles to a 256-iteration double-and-add loop using
  Jacobian coordinates -- roughly 1,500 bytes of Script. ec_add uses affine
  addition with modular inverses -- roughly 800 bytes. The compiler handles all
  coordinate math automatically; the developer works with high-level point
  operations.

The 10 EC primitives:
  1. ec_point_x(p)            -- Extract x-coordinate from a point
  2. ec_point_y(p)            -- Extract y-coordinate from a point
  3. ec_make_point(x, y)      -- Construct a point from coordinates
  4. ec_on_curve(p)           -- Check if a point lies on the curve
  5. ec_add(a, b)             -- Add two curve points
  6. ec_mul(p, k)             -- Scalar multiplication: k * P
  7. ec_mul_gen(k)            -- Generator multiplication: k * G (optimized)
  8. ec_negate(p)             -- Negate a point: (x, p - y)
  9. ec_mod_reduce(v, m)      -- Modular reduction for group arithmetic
  10. ec_encode_compressed(p)  -- Compress to 33-byte public key format

This contract is stateless (SmartContract), so each method is an independent
spending condition. No signature checks are performed -- the focus is purely on
demonstrating EC operations.
"""

from runar import (
    SmartContract, Point, ByteString, Bigint, public, assert_,
    ec_add, ec_mul, ec_mul_gen, ec_negate, ec_on_curve,
    ec_mod_reduce, ec_encode_compressed, ec_make_point,
    ec_point_x, ec_point_y, EC_N,
)


class ECDemo(SmartContract):
    """Demonstrates every built-in elliptic curve primitive on secp256k1.

    Stores a single curve point \`\`pt\`\` as a contract property and exposes
    14 public methods -- one for each EC operation or algebraic property.
    """

    pt: Point

    def __init__(self, pt: Point):
        super().__init__(pt)
        self.pt = pt

    # -------------------------------------------------------------------
    # Coordinate extraction and construction
    # -------------------------------------------------------------------

    @public
    def check_x(self, expected_x: Bigint):
        """Extract the x-coordinate from the stored point and verify it
        matches the expected value.

        \`\`ec_point_x\`\` splits a 64-byte Point into its first 32 bytes
        (big-endian unsigned x-coordinate) and converts to a script number.

        Use cases: comparing public key x-coordinates, Schnorr signature
        verification (which only uses the x-coordinate).
        """
        assert_(ec_point_x(self.pt) == expected_x)

    @public
    def check_y(self, expected_y: Bigint):
        """Extract the y-coordinate from the stored point and verify it
        matches the expected value.

        \`\`ec_point_y\`\` splits a 64-byte Point into its last 32 bytes
        (big-endian unsigned y-coordinate) and converts to a script number.

        Use cases: full point comparison, parity checks for compressed encoding.
        """
        assert_(ec_point_y(self.pt) == expected_y)

    @public
    def check_make_point(self, x: Bigint, y: Bigint, expected_x: Bigint, expected_y: Bigint):
        """Construct a point from x and y coordinates, then verify the result
        matches the expected coordinates.

        \`\`ec_make_point(x, y)\`\` encodes each coordinate as a 32-byte big-endian
        unsigned integer and concatenates them into a 64-byte Point.

        Use cases: reconstructing points from stored coordinates, building
        points from external data.
        """
        p = ec_make_point(x, y)
        assert_(ec_point_x(p) == expected_x)
        assert_(ec_point_y(p) == expected_y)

    # -------------------------------------------------------------------
    # Curve membership
    # -------------------------------------------------------------------

    @public
    def check_on_curve(self):
        """Verify the stored point lies on the secp256k1 curve.

        \`\`ec_on_curve(p)\`\` checks the curve equation: y^2 === x^3 + 7 (mod p).
        Returns true if the point satisfies the equation, false otherwise.

        Use cases: validating untrusted points from transaction inputs before
        performing EC arithmetic (prevents invalid-curve attacks).
        """
        assert_(ec_on_curve(self.pt))

    # -------------------------------------------------------------------
    # Point arithmetic
    # -------------------------------------------------------------------

    @public
    def check_add(self, other: Point, expected_x: Bigint, expected_y: Bigint):
        """Add two curve points and verify the result.

        \`\`ec_add(a, b)\`\` performs elliptic curve point addition using the
        affine addition formula:
          lambda = (y2 - y1) / (x2 - x1) mod p
          x3 = lambda^2 - x1 - x2 mod p
          y3 = lambda(x1 - x3) - y1 mod p

        This compiles to ~800 bytes of Bitcoin Script including a modular
        inverse computation.

        Use cases: combining public keys (key aggregation), Schnorr multi-sig,
        Pedersen commitments (C = v*G + r*H).
        """
        result = ec_add(self.pt, other)
        assert_(ec_point_x(result) == expected_x)
        assert_(ec_point_y(result) == expected_y)

    @public
    def check_mul(self, scalar: Bigint, expected_x: Bigint, expected_y: Bigint):
        """Multiply the stored point by a scalar and verify the result.

        \`\`ec_mul(p, k)\`\` computes k * P using a 256-bit double-and-add algorithm
        in Jacobian coordinates (to avoid per-step modular inverses). The final
        result is converted back to affine coordinates.

        This is the most expensive EC operation: ~1,500 bytes of Bitcoin Script
        with a 256-iteration loop.

        Use cases: public key derivation (P = k*G), Diffie-Hellman shared
        secrets, BIP-32 child key derivation.
        """
        result = ec_mul(self.pt, scalar)
        assert_(ec_point_x(result) == expected_x)
        assert_(ec_point_y(result) == expected_y)

    @public
    def check_mul_gen(self, scalar: Bigint, expected_x: Bigint, expected_y: Bigint):
        """Multiply the generator point G by a scalar and verify the result.

        \`\`ec_mul_gen(k)\`\` is equivalent to \`\`ec_mul(EC_G, k)\`\` but the
        generator point is hardcoded into the compiled script, saving the
        overhead of pushing 64 bytes of point data.

        Use cases: deriving a public key from a private key (the fundamental
        operation in elliptic curve cryptography), generating nonce points
        for Schnorr proofs (R = r*G).
        """
        result = ec_mul_gen(scalar)
        assert_(ec_point_x(result) == expected_x)
        assert_(ec_point_y(result) == expected_y)

    # -------------------------------------------------------------------
    # Point negation
    # -------------------------------------------------------------------

    @public
    def check_negate(self, expected_neg_y: Bigint):
        """Negate the stored point and verify the result's y-coordinate.

        \`\`ec_negate(p)\`\` returns the point (x, field_prime - y). This is
        the additive inverse: P + (-P) = point at infinity.

        Use cases: subtraction of points (A - B = A + (-B)), cancellation
        checks in zero-knowledge proofs.
        """
        neg = ec_negate(self.pt)
        assert_(ec_point_y(neg) == expected_neg_y)

    @public
    def check_negate_roundtrip(self):
        """Verify that negating a point twice returns the original point.

        This demonstrates the involution property: -(-P) = P. Double negation
        is a no-op, which the compiler can optimize away at the ANF level.
        """
        neg1 = ec_negate(self.pt)
        neg2 = ec_negate(neg1)
        assert_(ec_point_x(neg2) == ec_point_x(self.pt))
        assert_(ec_point_y(neg2) == ec_point_y(self.pt))

    # -------------------------------------------------------------------
    # Modular arithmetic
    # -------------------------------------------------------------------

    @public
    def check_mod_reduce(self, value: Bigint, modulus: Bigint, expected: Bigint):
        """Perform modular reduction and verify the result.

        \`\`ec_mod_reduce(value, mod)\`\` computes \`\`((value % mod) + mod) % mod\`\`,
        ensuring the result is always non-negative. This is essential for
        EC group arithmetic where scalars must be in [0, n-1].

        Use cases: reducing Schnorr response values mod n, ensuring private
        key scalars are in the valid range, hash-to-scalar conversion.
        """
        assert_(ec_mod_reduce(value, modulus) == expected)

    # -------------------------------------------------------------------
    # Compressed encoding
    # -------------------------------------------------------------------

    @public
    def check_encode_compressed(self, expected: ByteString):
        """Compress the stored point to 33-byte public key format and verify.

        \`\`ec_encode_compressed(p)\`\` produces a 33-byte encoding: a prefix byte
        (0x02 if y is even, 0x03 if y is odd) followed by the 32-byte
        x-coordinate. This is the standard Bitcoin compressed public key format.

        Use cases: generating public key hashes for P2PKH addresses, comparing
        computed keys against stored key hashes, interoperating with standard
        Bitcoin tooling.
        """
        compressed = ec_encode_compressed(self.pt)
        assert_(compressed == expected)

    # -------------------------------------------------------------------
    # Algebraic properties
    # -------------------------------------------------------------------

    @public
    def check_mul_identity(self):
        """Verify that scalar multiplication by 1 is the identity operation.

        For any point P: 1 * P = P. This is a fundamental algebraic property
        and a useful sanity check that ec_mul handles the identity scalar.
        """
        result = ec_mul(self.pt, 1)
        assert_(ec_point_x(result) == ec_point_x(self.pt))
        assert_(ec_point_y(result) == ec_point_y(self.pt))

    @public
    def check_add_on_curve(self, other: Point):
        """Verify that the result of ec_add lies on the curve.

        Closure property: if A and B are on the curve, then A + B is also on
        the curve. This is guaranteed by the group law but serves as a
        correctness check for the EC addition implementation.
        """
        result = ec_add(self.pt, other)
        assert_(ec_on_curve(result))

    @public
    def check_mul_gen_on_curve(self, scalar: Bigint):
        """Verify that a generator multiplication result lies on the curve.

        For any scalar k, k * G must be a valid curve point. This tests the
        ec_mul_gen implementation produces points satisfying the curve equation.
        """
        result = ec_mul_gen(scalar)
        assert_(ec_on_curve(result))
`,
    constructorArgs: {
      pt: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'checkOnCurve',
      args: [],
    },
    description: 'Demonstrates all 10 secp256k1 elliptic curve primitives available in Runar.',
  },
  {
    id: 'zig-ec-demo',
    name: 'EC Primitives Demo (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const ECDemo = struct {
    pub const Contract = runar.SmartContract;

    pt: runar.Point,

    pub fn init(pt: runar.Point) ECDemo {
        return .{ .pt = pt };
    }

    pub fn checkX(self: *const ECDemo, expectedX: i64) void {
        runar.assert(runar.ecPointX(self.pt) == expectedX);
    }

    pub fn checkY(self: *const ECDemo, expectedY: i64) void {
        runar.assert(runar.ecPointY(self.pt) == expectedY);
    }

    pub fn checkMakePoint(self: *const ECDemo, x: i64, y: i64, expectedX: i64, expectedY: i64) void {
        _ = self;
        const p = runar.ecMakePoint(x, y);
        runar.assert(runar.ecPointX(p) == expectedX);
        runar.assert(runar.ecPointY(p) == expectedY);
    }

    pub fn checkOnCurve(self: *const ECDemo) void {
        runar.assert(runar.ecOnCurve(self.pt));
    }

    pub fn checkAdd(self: *const ECDemo, other: runar.Point, expectedX: i64, expectedY: i64) void {
        const result = runar.ecAdd(self.pt, other);
        runar.assert(runar.ecPointX(result) == expectedX);
        runar.assert(runar.ecPointY(result) == expectedY);
    }

    pub fn checkMul(self: *const ECDemo, scalar: i64, expectedX: i64, expectedY: i64) void {
        const result = runar.ecMul(self.pt, scalar);
        runar.assert(runar.ecPointX(result) == expectedX);
        runar.assert(runar.ecPointY(result) == expectedY);
    }

    pub fn checkMulGen(self: *const ECDemo, scalar: i64, expectedX: i64, expectedY: i64) void {
        _ = self;
        const result = runar.ecMulGen(scalar);
        runar.assert(runar.ecPointX(result) == expectedX);
        runar.assert(runar.ecPointY(result) == expectedY);
    }

    pub fn checkNegate(self: *const ECDemo, expectedNegY: i64) void {
        const neg = runar.ecNegate(self.pt);
        runar.assert(runar.ecPointY(neg) == expectedNegY);
    }

    pub fn checkNegateRoundtrip(self: *const ECDemo) void {
        const neg1 = runar.ecNegate(self.pt);
        const neg2 = runar.ecNegate(neg1);
        runar.assert(runar.bytesEq(runar.ecEncodeCompressed(neg2), runar.ecEncodeCompressed(self.pt)));
    }

    pub fn checkModReduce(self: *const ECDemo, value: i64, modulus: i64, expected: i64) void {
        _ = self;
        runar.assert(runar.ecModReduce(value, modulus) == expected);
    }

    pub fn checkEncodeCompressed(self: *const ECDemo, expected: runar.ByteString) void {
        runar.assert(runar.bytesEq(runar.ecEncodeCompressed(self.pt), expected));
    }

    pub fn checkMulIdentity(self: *const ECDemo) void {
        const result = runar.ecMul(self.pt, 1);
        runar.assert(runar.bytesEq(runar.ecEncodeCompressed(result), runar.ecEncodeCompressed(self.pt)));
    }

    pub fn checkAddOnCurve(self: *const ECDemo, other: runar.Point) void {
        runar.assert(runar.ecOnCurve(runar.ecAdd(self.pt, other)));
    }

    pub fn checkMulGenOnCurve(self: *const ECDemo, scalar: i64) void {
        _ = self;
        runar.assert(runar.ecOnCurve(runar.ecMulGen(scalar)));
    }
};
`,
    constructorArgs: {
      pt: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'checkOnCurve',
      args: [],
    },
    description: 'Demonstrates all 10 secp256k1 elliptic curve primitives available in Runar.',
  },
  {
    id: 'ruby-ec-demo',
    name: 'EC Primitives Demo (Ruby)',
    language: 'ruby',
    source: `require 'runar'

# ECDemo -- A stateless contract demonstrating every built-in elliptic curve
# primitive available in Runar.
#
# Runar provides 10 built-in functions for secp256k1 elliptic curve arithmetic.
# These compile into Bitcoin Script opcodes that perform real EC math on-chain,
# enabling advanced cryptographic protocols like Schnorr signatures, zero-knowledge
# proofs, and key derivation -- all enforced by the Bitcoin network.
#
# Curve: secp256k1
#   - Field prime p = 2^256 - 2^32 - 977
#   - Group order n = FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
#   - Generator point G is a fixed curve point; ec_mul_gen(k) computes k*G
#   - Points are 64 bytes: x[32] || y[32], big-endian unsigned, no prefix byte
#
# How EC operations compile to Bitcoin Script:
#   Each EC function expands into a sequence of stack operations during
#   compilation. For example, ec_mul compiles to a 256-iteration double-and-add
#   loop using Jacobian coordinates -- roughly 1,500 bytes of Script. ec_add
#   uses affine addition with modular inverses -- roughly 800 bytes. The
#   compiler handles all coordinate math automatically; the developer works
#   with high-level point operations.
#
# The 10 EC primitives:
#   1.  ec_point_x(p)             -- Extract x-coordinate from a point
#   2.  ec_point_y(p)             -- Extract y-coordinate from a point
#   3.  ec_make_point(x, y)       -- Construct a point from coordinates
#   4.  ec_on_curve(p)            -- Check if a point lies on the curve
#   5.  ec_add(a, b)              -- Add two curve points
#   6.  ec_mul(p, k)              -- Scalar multiplication: k * P
#   7.  ec_mul_gen(k)             -- Generator multiplication: k * G (optimized)
#   8.  ec_negate(p)              -- Negate a point: (x, p - y)
#   9.  ec_mod_reduce(v, m)       -- Modular reduction for group arithmetic
#   10. ec_encode_compressed(p)   -- Compress to 33-byte public key format
#
# This contract is stateless (SmartContract), so each method is an independent
# spending condition. No signature checks are performed -- the focus is purely
# on demonstrating EC operations.

class EcDemo < Runar::SmartContract
  # A curve point stored as a contract property. Used as input to most methods.
  prop :pt, Point

  def initialize(pt)
    super(pt)
    @pt = pt
  end

  # -----------------------------------------------------------------
  # Coordinate extraction and construction
  # -----------------------------------------------------------------

  # Extract the x-coordinate from the stored point and verify it matches
  # the expected value.
  #
  # ec_point_x splits a 64-byte Point into its first 32 bytes (big-endian
  # unsigned x-coordinate) and converts to a script number.
  #
  # Use cases: comparing public key x-coordinates, Schnorr signature
  # verification (which only uses the x-coordinate).
  runar_public expected_x: Bigint
  def check_x(expected_x)
    assert ec_point_x(@pt) == expected_x
  end

  # Extract the y-coordinate from the stored point and verify it matches
  # the expected value.
  #
  # ec_point_y splits a 64-byte Point into its last 32 bytes (big-endian
  # unsigned y-coordinate) and converts to a script number.
  #
  # Use cases: full point comparison, parity checks for compressed encoding.
  runar_public expected_y: Bigint
  def check_y(expected_y)
    assert ec_point_y(@pt) == expected_y
  end

  # Construct a point from x and y coordinates, then verify the result
  # matches the expected coordinates.
  #
  # ec_make_point(x, y) encodes each coordinate as a 32-byte big-endian
  # unsigned integer and concatenates them into a 64-byte Point.
  #
  # Use cases: reconstructing points from stored coordinates, building
  # points from external data.
  runar_public x: Bigint, y: Bigint, expected_x: Bigint, expected_y: Bigint
  def check_make_point(x, y, expected_x, expected_y)
    p = ec_make_point(x, y)
    assert ec_point_x(p) == expected_x
    assert ec_point_y(p) == expected_y
  end

  # -----------------------------------------------------------------
  # Curve membership
  # -----------------------------------------------------------------

  # Verify the stored point lies on the secp256k1 curve.
  #
  # ec_on_curve(p) checks the curve equation: y^2 == x^3 + 7 (mod p).
  # Returns true if the point satisfies the equation, false otherwise.
  #
  # Use cases: validating untrusted points from transaction inputs before
  # performing EC arithmetic (prevents invalid-curve attacks).
  runar_public
  def check_on_curve
    assert ec_on_curve(@pt)
  end

  # -----------------------------------------------------------------
  # Point arithmetic
  # -----------------------------------------------------------------

  # Add two curve points and verify the result.
  #
  # ec_add(a, b) performs elliptic curve point addition using the affine
  # addition formula:
  #   lambda = (y2 - y1) / (x2 - x1) mod p
  #   x3 = lambda^2 - x1 - x2 mod p
  #   y3 = lambda(x1 - x3) - y1 mod p
  #
  # This compiles to ~800 bytes of Bitcoin Script including a modular
  # inverse computation.
  #
  # Use cases: combining public keys (key aggregation), Schnorr multi-sig,
  # Pedersen commitments (C = v*G + r*H).
  runar_public other: Point, expected_x: Bigint, expected_y: Bigint
  def check_add(other, expected_x, expected_y)
    result = ec_add(@pt, other)
    assert ec_point_x(result) == expected_x
    assert ec_point_y(result) == expected_y
  end

  # Multiply the stored point by a scalar and verify the result.
  #
  # ec_mul(p, k) computes k * P using a 256-bit double-and-add algorithm
  # in Jacobian coordinates (to avoid per-step modular inverses). The final
  # result is converted back to affine coordinates.
  #
  # This is the most expensive EC operation: ~1,500 bytes of Bitcoin Script
  # with a 256-iteration loop.
  #
  # Use cases: public key derivation (P = k*G), Diffie-Hellman shared
  # secrets, BIP-32 child key derivation.
  runar_public scalar: Bigint, expected_x: Bigint, expected_y: Bigint
  def check_mul(scalar, expected_x, expected_y)
    result = ec_mul(@pt, scalar)
    assert ec_point_x(result) == expected_x
    assert ec_point_y(result) == expected_y
  end

  # Multiply the generator point G by a scalar and verify the result.
  #
  # ec_mul_gen(k) is equivalent to ec_mul(EC_G, k) but the generator point
  # is hardcoded into the compiled script, saving the overhead of pushing
  # 64 bytes of point data.
  #
  # Use cases: deriving a public key from a private key (the fundamental
  # operation in elliptic curve cryptography), generating nonce points
  # for Schnorr proofs (R = r*G).
  runar_public scalar: Bigint, expected_x: Bigint, expected_y: Bigint
  def check_mul_gen(scalar, expected_x, expected_y)
    result = ec_mul_gen(scalar)
    assert ec_point_x(result) == expected_x
    assert ec_point_y(result) == expected_y
  end

  # -----------------------------------------------------------------
  # Point negation
  # -----------------------------------------------------------------

  # Negate the stored point and verify the result's y-coordinate.
  #
  # ec_negate(p) returns the point (x, field_prime - y). This is the
  # additive inverse: P + (-P) = point at infinity.
  #
  # Use cases: subtraction of points (A - B = A + (-B)), cancellation
  # checks in zero-knowledge proofs.
  runar_public expected_neg_y: Bigint
  def check_negate(expected_neg_y)
    neg = ec_negate(@pt)
    assert ec_point_y(neg) == expected_neg_y
  end

  # Verify that negating a point twice returns the original point.
  #
  # This demonstrates the involution property: -(-P) = P. Double negation
  # is a no-op, which the compiler can optimize away at the ANF level.
  runar_public
  def check_negate_roundtrip
    neg1 = ec_negate(@pt)
    neg2 = ec_negate(neg1)
    assert ec_point_x(neg2) == ec_point_x(@pt)
    assert ec_point_y(neg2) == ec_point_y(@pt)
  end

  # -----------------------------------------------------------------
  # Modular arithmetic
  # -----------------------------------------------------------------

  # Perform modular reduction and verify the result.
  #
  # ec_mod_reduce(value, mod) computes ((value % mod) + mod) % mod,
  # ensuring the result is always non-negative. This is essential for
  # EC group arithmetic where scalars must be in [0, n-1].
  #
  # Use cases: reducing Schnorr response values mod n, ensuring private
  # key scalars are in the valid range, hash-to-scalar conversion.
  runar_public value: Bigint, modulus: Bigint, expected: Bigint
  def check_mod_reduce(value, modulus, expected)
    assert ec_mod_reduce(value, modulus) == expected
  end

  # -----------------------------------------------------------------
  # Compressed encoding
  # -----------------------------------------------------------------

  # Compress the stored point to 33-byte public key format and verify.
  #
  # ec_encode_compressed(p) produces a 33-byte encoding: a prefix byte
  # (0x02 if y is even, 0x03 if y is odd) followed by the 32-byte
  # x-coordinate. This is the standard Bitcoin compressed public key format.
  #
  # Use cases: generating public key hashes for P2PKH addresses, comparing
  # computed keys against stored key hashes, interoperating with standard
  # Bitcoin tooling.
  runar_public expected: ByteString
  def check_encode_compressed(expected)
    compressed = ec_encode_compressed(@pt)
    assert compressed == expected
  end

  # -----------------------------------------------------------------
  # Algebraic properties
  # -----------------------------------------------------------------

  # Verify that scalar multiplication by 1 is the identity operation.
  #
  # For any point P: 1 * P = P. This is a fundamental algebraic property
  # and a useful sanity check that ec_mul handles the identity scalar.
  runar_public
  def check_mul_identity
    result = ec_mul(@pt, 1)
    assert ec_point_x(result) == ec_point_x(@pt)
    assert ec_point_y(result) == ec_point_y(@pt)
  end

  # Verify that the result of ec_add lies on the curve.
  #
  # Closure property: if A and B are on the curve, then A + B is also on
  # the curve. This is guaranteed by the group law but serves as a
  # correctness check for the EC addition implementation.
  runar_public other: Point
  def check_add_on_curve(other)
    result = ec_add(@pt, other)
    assert ec_on_curve(result)
  end

  # Verify that a generator multiplication result lies on the curve.
  #
  # For any scalar k, k * G must be a valid curve point. This tests the
  # ec_mul_gen implementation produces points satisfying the curve equation.
  runar_public scalar: Bigint
  def check_mul_gen_on_curve(scalar)
    result = ec_mul_gen(scalar)
    assert ec_on_curve(result)
  end
end
`,
    constructorArgs: {
      pt: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'checkOnCurve',
      args: [],
    },
    description: 'Demonstrates all 10 secp256k1 elliptic curve primitives available in Runar.',
  },
  {
    id: 'function-patterns',
    name: 'Function Patterns',
    language: 'typescript',
    source: `// FunctionPatterns demonstrates every way functions and methods can be
// used inside a Rúnar TypeScript contract.
//
// Rúnar contracts support four categories of callable code:
//
//   1. Public methods      — declared with the \`public\` keyword.
//                            These are the spending entry points that
//                            appear in the compiled Bitcoin Script.
//
//   2. Private methods     — declared with \`private\` (or no modifier).
//                            These can access contract state via \`this\`
//                            and are inlined by the compiler at call sites.
//                            Private methods may return a value.
//
//   3. Built-in functions  — imported from 'runar-lang' (e.g. assert,
//                            checkSig, safediv, percentOf, clamp).
//                            These map directly to Bitcoin Script opcodes.
//
// Note: TypeScript contracts cannot define standalone functions outside
// the class. All helper logic must be private methods on the class.

import {
  StatefulSmartContract,
  assert,
  checkSig,
  percentOf,
  mulDiv,
  clamp,
  safemod,
} from 'runar-lang';
import type { PubKey, Sig } from 'runar-lang';

class FunctionPatterns extends StatefulSmartContract {
  readonly owner: PubKey;  // immutable: contract creator
  balance: bigint;         // stateful: current balance

  constructor(owner: PubKey, balance: bigint) {
    super(owner, balance);
    this.owner = owner;
    this.balance = balance;
  }

  // -----------------------------------------------------------------------
  // 1. Public methods — spending entry points
  // -----------------------------------------------------------------------
  // Public methods become separate OP_IF branches in the compiled locking
  // script. The spending transaction selects which method to execute via a
  // method index pushed in the scriptSig.
  //
  // Public methods must not return a value.

  /** Deposit adds funds. Calls a private method and a built-in. */
  public deposit(sig: Sig, amount: bigint) {
    // Private method: shared signature check
    this.requireOwner(sig);

    // Built-in: assertion
    assert(amount > 0n);

    // Update state
    this.balance = this.balance + amount;
  }

  /**
   * Withdraw removes funds after applying a fee.
   * Demonstrates chaining a private method that returns a value.
   */
  public withdraw(sig: Sig, amount: bigint, feeBps: bigint) {
    this.requireOwner(sig);
    assert(amount > 0n);

    // Private method with return value
    const fee = this.computeFee(amount, feeBps);
    const total = amount + fee;

    assert(total <= this.balance);
    this.balance = this.balance - total;
  }

  /**
   * Scale multiplies the balance by a rational number.
   * Demonstrates calling a private method that wraps a built-in.
   */
  public scale(sig: Sig, numerator: bigint, denominator: bigint) {
    this.requireOwner(sig);
    this.balance = this.scaleValue(this.balance, numerator, denominator);
  }

  /**
   * Normalize clamps the balance to a range and rounds down.
   * Demonstrates composing multiple private helper methods.
   */
  public normalize(sig: Sig, lo: bigint, hi: bigint, step: bigint) {
    this.requireOwner(sig);
    const clamped = this.clampValue(this.balance, lo, hi);
    this.balance = this.roundDown(clamped, step);
  }

  // -----------------------------------------------------------------------
  // 2. Private methods — inlined helpers
  // -----------------------------------------------------------------------
  // Private methods can read/write contract state via \`this\` and may
  // return a value. The compiler inlines them at each call site — they
  // do not become separate script functions.

  /** Verify the caller is the contract owner. Shared by all public methods. */
  private requireOwner(sig: Sig) {
    assert(checkSig(sig, this.owner));
  }

  /** Compute a fee in basis points. Returns the fee amount. */
  private computeFee(amount: bigint, feeBps: bigint): bigint {
    return percentOf(amount, feeBps);
  }

  /** Multiply a value by a fraction using mulDiv for precision. */
  private scaleValue(value: bigint, numerator: bigint, denominator: bigint): bigint {
    return mulDiv(value, numerator, denominator);
  }

  /** Clamp a value to [lo, hi]. */
  private clampValue(value: bigint, lo: bigint, hi: bigint): bigint {
    return clamp(value, lo, hi);
  }

  /** Round down to the nearest multiple of step. */
  private roundDown(value: bigint, step: bigint): bigint {
    const remainder = safemod(value, step);
    return value - remainder;
  }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
    },
    methodCall: {
      method: 'deposit',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'bigint', value: '100' },
      ],
    },
    description: 'Demonstrates public methods, private methods, standalone helpers, and built-in functions.',
  },
  {
    id: 'go-function-patterns',
    name: 'Function Patterns (Go)',
    language: 'go',
    source: `// FunctionPatterns demonstrates every way functions and methods can be
// used inside a Rúnar Go contract.
//
// Rúnar contracts support four categories of callable code:
//
//   1. Public methods      — exported methods on the contract struct.
//                            These are the spending entry points that
//                            appear in the compiled Bitcoin Script.
//
//   2. Private methods     — unexported methods on the contract struct.
//                            These can access contract state via the
//                            receiver (c.Field) and are inlined by the
//                            compiler at call sites.
//
//   3. Standalone helpers  — unexported package-level functions (no
//                            receiver). Pure logic that cannot access
//                            contract state. Useful for math utilities
//                            and reusable computations.
//
//   4. Built-in functions  — functions from the runar package (e.g.
//                            runar.Assert, runar.Hash160, runar.Safediv).
//                            These map directly to Bitcoin Script opcodes.
//
// The receiver name can be anything (c, s, self, contract, etc.) — the
// compiler reads it from the method signature.

package contract

import runar "github.com/icellan/runar/packages/runar-go"

// ---------------------------------------------------------------------------
// Contract struct
// ---------------------------------------------------------------------------

// FunctionPatterns is a stateful contract that tracks a balance and an
// owner, demonstrating all the function call patterns available in Rúnar Go.
type FunctionPatterns struct {
	runar.StatefulSmartContract
	Owner   runar.PubKey \`runar:"readonly"\` // immutable: contract creator
	Balance runar.Bigint                   // stateful: current balance
}

// ---------------------------------------------------------------------------
// 1. Public methods — spending entry points
// ---------------------------------------------------------------------------
// Exported (capitalized) methods become public spending paths in the
// compiled locking script. Each is a separate OP_IF branch that the
// spending transaction selects via a method index.
//
// Public methods must not return a value.

// Deposit adds funds. Demonstrates calling a private method and a
// standalone helper from a public method.
func (c *FunctionPatterns) Deposit(sig runar.Sig, amount runar.Bigint) {
	// Built-in: signature verification
	c.requireOwner(sig)

	// Built-in: assertion with a standalone helper
	runar.Assert(isPositive(amount))

	// Update state
	c.Balance = c.Balance + amount
}

// Withdraw removes funds after applying a fee. Demonstrates chaining
// multiple private methods and built-in math functions.
func (c *FunctionPatterns) Withdraw(sig runar.Sig, amount runar.Bigint, feeBps runar.Bigint) {
	c.requireOwner(sig)
	runar.Assert(amount > 0)

	// Private method: compute fee
	fee := c.computeFee(amount, feeBps)
	total := amount + fee

	// Built-in: assert sufficient balance
	runar.Assert(total <= c.Balance)

	c.Balance = c.Balance - total
}

// Scale multiplies the balance by a rational number (num/denom).
// Demonstrates standalone helpers for pure math.
func (c *FunctionPatterns) Scale(sig runar.Sig, numerator runar.Bigint, denominator runar.Bigint) {
	c.requireOwner(sig)

	// Standalone helper: safe ratio scaling
	c.Balance = scaleValue(c.Balance, numerator, denominator)
}

// Normalize clamps the balance to a range and rounds down to the nearest
// step size. Demonstrates composing multiple standalone helpers.
func (c *FunctionPatterns) Normalize(sig runar.Sig, lo runar.Bigint, hi runar.Bigint, step runar.Bigint) {
	c.requireOwner(sig)

	// Standalone helpers composed together
	clamped := clampValue(c.Balance, lo, hi)
	c.Balance = roundDown(clamped, step)
}

// ---------------------------------------------------------------------------
// 2. Private methods — unexported methods with receiver
// ---------------------------------------------------------------------------
// Unexported (lowercase) methods on the contract struct are private.
// They can read and write contract state via the receiver, and are
// inlined at call sites by the compiler (no separate script function).
//
// Private methods may return a value.

// requireOwner verifies the signature matches the contract owner.
// This is a common pattern: extract repeated assertion logic into a
// private method so multiple public methods can share it.
func (c *FunctionPatterns) requireOwner(sig runar.Sig) {
	runar.Assert(runar.CheckSig(sig, c.Owner))
}

// computeFee calculates a fee in basis points on an amount.
// Returns the fee value. Demonstrates a private method with a return value
// that accesses no state (but could if needed).
func (c *FunctionPatterns) computeFee(amount runar.Bigint, feeBps runar.Bigint) runar.Bigint {
	return runar.PercentOf(amount, feeBps)
}

// ---------------------------------------------------------------------------
// 3. Standalone helper functions — no receiver
// ---------------------------------------------------------------------------
// Unexported package-level functions have no receiver and cannot access
// contract state (no c.Field). They are pure functions: input goes in
// via parameters, output comes back via return value.
//
// Use these for reusable math utilities, validation logic, or any
// computation that doesn't need contract fields.

// isPositive returns true if n > 0.
// Demonstrates the simplest standalone helper: a boolean predicate.
func isPositive(n runar.Bigint) bool {
	return n > 0
}

// scaleValue computes (value * numerator) / denominator safely.
// Demonstrates a standalone helper using a built-in math function.
func scaleValue(value runar.Bigint, numerator runar.Bigint, denominator runar.Bigint) runar.Bigint {
	return runar.MulDiv(value, numerator, denominator)
}

// clampValue constrains a value to the range [lo, hi].
// Demonstrates wrapping a built-in for readability.
func clampValue(value runar.Bigint, lo runar.Bigint, hi runar.Bigint) runar.Bigint {
	return runar.Clamp(value, lo, hi)
}

// roundDown rounds a value down to the nearest multiple of step.
// Demonstrates a standalone helper with arithmetic: value - (value % step).
func roundDown(value runar.Bigint, step runar.Bigint) runar.Bigint {
	remainder := runar.Safemod(value, step)
	return value - remainder
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
    },
    methodCall: {
      method: 'deposit',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'bigint', value: '100' },
      ],
    },
    description: 'Demonstrates public methods, private methods, standalone helpers, and built-in functions.',
  },
  {
    id: 'rust-function-patterns',
    name: 'Function Patterns (Rust)',
    language: 'rust',
    source: `// FunctionPatterns demonstrates every way functions and methods can be
// used inside a Rúnar Rust contract.
//
// Rúnar contracts support three categories of callable code:
//
//   1. Public methods      — annotated with #[public]. These are the
//                            spending entry points that appear in the
//                            compiled Bitcoin Script.
//
//   2. Private methods     — methods without #[public]. These can access
//                            contract state via &self / &mut self and are
//                            inlined by the compiler at call sites.
//                            Private methods may return a value.
//
//   3. Built-in functions  — functions from runar::prelude (e.g. check_sig,
//                            safediv, percent_of, clamp). These map
//                            directly to Bitcoin Script opcodes.
//
// Note: standalone functions outside the impl block are not supported
// by the Rúnar Rust parser. All helpers must be methods on the struct.

use runar::prelude::*;

#[runar::contract]
pub struct FunctionPatterns {
    #[readonly]
    pub owner: PubKey,   // immutable: contract creator
    pub balance: Bigint, // stateful: current balance
}

#[runar::methods(FunctionPatterns)]
impl FunctionPatterns {
    // -------------------------------------------------------------------
    // 1. Public methods — spending entry points
    // -------------------------------------------------------------------
    // #[public] methods become separate OP_IF branches in the compiled
    // locking script.
    //
    // Public methods take &mut self and must not return a value.

    /// Deposit adds funds. Calls a private method and a built-in.
    #[public]
    pub fn deposit(&mut self, sig: &Sig, amount: Bigint) {
        // Private method: shared signature check
        self.require_owner(sig);

        // Built-in: assertion
        assert!(amount > 0);

        // Update state
        self.balance += amount;
    }

    /// Withdraw removes funds after applying a fee.
    /// Demonstrates a private method that returns a value.
    #[public]
    pub fn withdraw(&mut self, sig: &Sig, amount: Bigint, fee_bps: Bigint) {
        self.require_owner(sig);
        assert!(amount > 0);

        // Private method with return value
        let fee = self.compute_fee(amount, fee_bps);
        let total = amount + fee;

        assert!(total <= self.balance);
        self.balance -= total;
    }

    /// Scale multiplies the balance by a rational number.
    /// Demonstrates a private method wrapping a built-in.
    #[public]
    pub fn scale(&mut self, sig: &Sig, numerator: Bigint, denominator: Bigint) {
        self.require_owner(sig);
        self.balance = self.scale_value(self.balance, numerator, denominator);
    }

    /// Normalize clamps the balance to a range and rounds down.
    /// Demonstrates composing multiple private helper methods.
    #[public]
    pub fn normalize(&mut self, sig: &Sig, lo: Bigint, hi: Bigint, step: Bigint) {
        self.require_owner(sig);
        let clamped = self.clamp_value(self.balance, lo, hi);
        self.balance = self.round_down(clamped, step);
    }

    // -------------------------------------------------------------------
    // 2. Private methods — inlined helpers
    // -------------------------------------------------------------------
    // Methods without #[public] are private. They can read/write contract
    // state via &self / &mut self and may return a value.

    /// Verify the caller is the contract owner.
    fn require_owner(&self, sig: &Sig) {
        assert!(check_sig(sig, &self.owner));
    }

    /// Compute a fee in basis points. Returns the fee amount.
    fn compute_fee(&self, amount: Bigint, fee_bps: Bigint) -> Bigint {
        percent_of(amount, fee_bps)
    }

    /// Multiply a value by a fraction using mul_div for precision.
    fn scale_value(&self, value: Bigint, numerator: Bigint, denominator: Bigint) -> Bigint {
        mul_div(value, numerator, denominator)
    }

    /// Clamp a value to [lo, hi].
    fn clamp_value(&self, value: Bigint, lo: Bigint, hi: Bigint) -> Bigint {
        clamp(value, lo, hi)
    }

    /// Round down to the nearest multiple of step.
    fn round_down(&self, value: Bigint, step: Bigint) -> Bigint {
        let remainder = safemod(value, step);
        value - remainder
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
    },
    methodCall: {
      method: 'deposit',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'bigint', value: '100' },
      ],
    },
    description: 'Demonstrates public methods, private methods, standalone helpers, and built-in functions.',
  },
  {
    id: 'python-function-patterns',
    name: 'Function Patterns (Python)',
    language: 'python',
    source: `# FunctionPatterns demonstrates every way functions and methods can be
# used inside a Runar Python contract.
#
# Runar contracts support three categories of callable code:
#
#   1. Public methods      -- decorated with @public. These are the
#                             spending entry points that appear in the
#                             compiled Bitcoin Script.
#
#   2. Private methods     -- prefixed with underscore (e.g. _helper).
#                             These can access contract state via self
#                             and are inlined by the compiler at call
#                             sites. Private methods may return a value.
#
#   3. Built-in functions  -- imported from runar (e.g. assert_,
#                             check_sig, percent_of, clamp). These map
#                             directly to Bitcoin Script opcodes.
#
# Note: Python contracts cannot define standalone functions outside
# the class. All helper logic must be private methods on the class.

from runar import (
    StatefulSmartContract, PubKey, Sig, Bigint, Readonly,
    public, assert_, check_sig, percent_of, mul_div, clamp, safemod,
)

class FunctionPatterns(StatefulSmartContract):
    """Stateful contract demonstrating all function call patterns in Runar Python."""

    owner: Readonly[PubKey]   # immutable: contract creator
    balance: Bigint           # stateful: current balance

    def __init__(self, owner: PubKey, balance: Bigint):
        super().__init__(owner, balance)
        self.owner = owner
        self.balance = balance

    # -------------------------------------------------------------------
    # 1. Public methods -- spending entry points
    # -------------------------------------------------------------------
    # @public methods become separate OP_IF branches in the compiled
    # locking script. The spending transaction selects which method to
    # execute via a method index pushed in the scriptSig.
    #
    # Public methods must not return a value.

    @public
    def deposit(self, sig: Sig, amount: Bigint):
        """Deposit adds funds. Calls a private method and a built-in."""
        # Private method: shared signature check
        self._require_owner(sig)

        # Built-in: assertion
        assert_(amount > 0)

        # Update state
        self.balance = self.balance + amount

    @public
    def withdraw(self, sig: Sig, amount: Bigint, fee_bps: Bigint):
        """Withdraw removes funds after applying a fee.

        Demonstrates chaining a private method that returns a value.
        """
        self._require_owner(sig)
        assert_(amount > 0)

        # Private method with return value
        fee = self._compute_fee(amount, fee_bps)
        total = amount + fee

        assert_(total <= self.balance)
        self.balance = self.balance - total

    @public
    def scale(self, sig: Sig, numerator: Bigint, denominator: Bigint):
        """Scale multiplies the balance by a rational number.

        Demonstrates calling a private method that wraps a built-in.
        """
        self._require_owner(sig)
        self.balance = self._scale_value(self.balance, numerator, denominator)

    @public
    def normalize(self, sig: Sig, lo: Bigint, hi: Bigint, step: Bigint):
        """Normalize clamps the balance to a range and rounds down.

        Demonstrates composing multiple private helper methods.
        """
        self._require_owner(sig)
        clamped = self._clamp_value(self.balance, lo, hi)
        self.balance = self._round_down(clamped, step)

    # -------------------------------------------------------------------
    # 2. Private methods -- inlined helpers
    # -------------------------------------------------------------------
    # Methods prefixed with underscore are private. They can read/write
    # contract state via self and may return a value. The compiler
    # inlines them at each call site -- they do not become separate
    # script functions.

    def _require_owner(self, sig: Sig):
        """Verify the caller is the contract owner. Shared by all public methods."""
        assert_(check_sig(sig, self.owner))

    def _compute_fee(self, amount: Bigint, fee_bps: Bigint) -> Bigint:
        """Compute a fee in basis points. Returns the fee amount."""
        return percent_of(amount, fee_bps)

    def _scale_value(self, value: Bigint, numerator: Bigint, denominator: Bigint) -> Bigint:
        """Multiply a value by a fraction using mul_div for precision."""
        return mul_div(value, numerator, denominator)

    def _clamp_value(self, value: Bigint, lo: Bigint, hi: Bigint) -> Bigint:
        """Clamp a value to [lo, hi]."""
        return clamp(value, lo, hi)

    def _round_down(self, value: Bigint, step: Bigint) -> Bigint:
        """Round down to the nearest multiple of step."""
        remainder = safemod(value, step)
        return value - remainder
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
    },
    methodCall: {
      method: 'deposit',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'bigint', value: '100' },
      ],
    },
    description: 'Demonstrates public methods, private methods, standalone helpers, and built-in functions.',
  },
  {
    id: 'zig-function-patterns',
    name: 'Function Patterns (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const FunctionPatterns = struct {
    pub const Contract = runar.StatefulSmartContract;

    owner: runar.PubKey,
    balance: i64 = 0,

    pub fn init(owner: runar.PubKey, balance: i64) FunctionPatterns {
        return .{
            .owner = owner,
            .balance = balance,
        };
    }

    pub fn deposit(self: *FunctionPatterns, sig: runar.Sig, amount: i64) void {
        self.requireOwner(sig);
        runar.assert(amount > 0);
        self.balance = self.balance + amount;
    }

    pub fn withdraw(self: *FunctionPatterns, sig: runar.Sig, amount: i64, feeBps: i64) void {
        self.requireOwner(sig);
        runar.assert(amount > 0);

        const fee = self.computeFee(amount, feeBps);
        const total = amount + fee;
        runar.assert(total <= self.balance);
        self.balance = self.balance - total;
    }

    pub fn scale(self: *FunctionPatterns, sig: runar.Sig, numerator: i64, denominator: i64) void {
        self.requireOwner(sig);
        self.balance = self.scaleValue(self.balance, numerator, denominator);
    }

    pub fn normalize(self: *FunctionPatterns, sig: runar.Sig, lo: i64, hi: i64, step: i64) void {
        self.requireOwner(sig);
        const clamped = self.clampValue(self.balance, lo, hi);
        self.balance = self.roundDown(clamped, step);
    }

    fn requireOwner(self: *const FunctionPatterns, sig: runar.Sig) void {
        runar.assert(runar.checkSig(sig, self.owner));
    }

    fn computeFee(self: *const FunctionPatterns, amount: i64, feeBps: i64) i64 {
        _ = self;
        return runar.percentOf(amount, feeBps);
    }

    fn scaleValue(self: *const FunctionPatterns, value: i64, numerator: i64, denominator: i64) i64 {
        _ = self;
        return runar.mulDiv(value, numerator, denominator);
    }

    fn clampValue(self: *const FunctionPatterns, value: i64, lo: i64, hi: i64) i64 {
        _ = self;
        return runar.clamp(value, lo, hi);
    }

    fn roundDown(self: *const FunctionPatterns, value: i64, step: i64) i64 {
        _ = self;
        const remainder = runar.safemod(value, step);
        return value - remainder;
    }
};
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
    },
    methodCall: {
      method: 'deposit',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'bigint', value: '100' },
      ],
    },
    description: 'Demonstrates public methods, private methods, standalone helpers, and built-in functions.',
  },
  {
    id: 'ruby-function-patterns',
    name: 'Function Patterns (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class FunctionPatterns < Runar::StatefulSmartContract
  prop :owner, PubKey, readonly: true
  prop :balance, Bigint

  def initialize(owner, balance)
    super(owner, balance)
    @owner = owner
    @balance = balance
  end

  runar_public sig: Sig, amount: Bigint
  def deposit(sig, amount)
    _require_owner(sig)
    assert amount > 0
    @balance = @balance + amount
  end

  runar_public sig: Sig, amount: Bigint, fee_bps: Bigint
  def withdraw(sig, amount, fee_bps)
    _require_owner(sig)
    assert amount > 0
    fee = _compute_fee(amount, fee_bps)
    total = amount + fee
    assert total <= @balance
    @balance = @balance - total
  end

  runar_public sig: Sig, numerator: Bigint, denominator: Bigint
  def scale(sig, numerator, denominator)
    _require_owner(sig)
    @balance = _scale_value(@balance, numerator, denominator)
  end

  runar_public sig: Sig, lo: Bigint, hi: Bigint, step: Bigint
  def normalize(sig, lo, hi, step)
    _require_owner(sig)
    clamped = _clamp_value(@balance, lo, hi)
    @balance = _round_down(clamped, step)
  end

  private

  params sig: Sig
  def _require_owner(sig)
    assert check_sig(sig, @owner)
  end

  params amount: Bigint, fee_bps: Bigint
  def _compute_fee(amount, fee_bps)
    percent_of(amount, fee_bps)
  end

  params value: Bigint, numerator: Bigint, denominator: Bigint
  def _scale_value(value, numerator, denominator)
    mul_div(value, numerator, denominator)
  end

  params value: Bigint, lo: Bigint, hi: Bigint
  def _clamp_value(value, lo, hi)
    clamp(value, lo, hi)
  end

  params value: Bigint, step: Bigint
  def _round_down(value, step)
    remainder = safemod(value, step)
    value - remainder
  end
end
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
    },
    methodCall: {
      method: 'deposit',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'bigint', value: '100' },
      ],
    },
    description: 'Demonstrates public methods, private methods, standalone helpers, and built-in functions.',
  },
  {
    id: 'math-demo',
    name: 'Math Demo',
    language: 'typescript',
    source: `import {
  StatefulSmartContract,
  assert,
  safediv,
  percentOf,
  clamp,
  sign,
  pow,
  sqrt,
  gcd,
  mulDiv,
  log2,
} from 'runar-lang';

/**
 * MathDemo — A stateful contract demonstrating every built-in math function
 * available in Rúnar.
 *
 * Bitcoin Script has limited native arithmetic (ADD, SUB, MUL, DIV, MOD).
 * Rúnar provides higher-level math functions that compile into sequences of
 * these primitives, enabling complex financial calculations on-chain.
 *
 * Each public method applies one math operation to the contract's stored
 * \`value\`, showing how these functions compile to pure Bitcoin Script.
 * All operations use integer math — no floating point.
 *
 * This contract is intentionally minimal: no signature checks are performed,
 * so any caller can invoke any method. In production, you would combine these
 * math operations with authentication logic.
 */
class MathDemo extends StatefulSmartContract {
  value: bigint;

  constructor(value: bigint) {
    super(value);
    this.value = value;
  }

  /**
   * Safe division — divides the stored value by \`divisor\`, asserting that
   * \`divisor\` is non-zero. The transaction fails if divisor is 0.
   *
   * Use cases: splitting payments, computing averages.
   */
  public divideBy(divisor: bigint) {
    this.value = safediv(this.value, divisor);
  }

  /**
   * Withdraw with a fee calculated in basis points (1 bps = 0.01%).
   * \`percentOf(amount, feeBps)\` computes \`amount * feeBps / 10000\`.
   * Asserts that the total (amount + fee) does not exceed the stored value.
   *
   * Use cases: fee calculation, royalties, commission deductions.
   */
  public withdrawWithFee(amount: bigint, feeBps: bigint) {
    const fee = percentOf(amount, feeBps);
    const total = amount + fee;
    assert(total <= this.value);
    this.value = this.value - total;
  }

  /**
   * Constrains the stored value to the range [lo, hi].
   * If value < lo, it becomes lo. If value > hi, it becomes hi.
   *
   * Use cases: enforcing min/max limits on bids, prices, or balances.
   */
  public clampValue(lo: bigint, hi: bigint) {
    this.value = clamp(this.value, lo, hi);
  }

  /**
   * Replaces the stored value with its sign: -1, 0, or 1.
   *
   * Use cases: direction detection, comparison results, branch selection.
   */
  public normalize() {
    this.value = sign(this.value);
  }

  /**
   * Raises the stored value to the power \`exp\` (integer exponentiation).
   *
   * Use cases: compound interest, polynomial evaluation.
   */
  public exponentiate(exp: bigint) {
    this.value = pow(this.value, exp);
  }

  /**
   * Replaces the stored value with its integer square root (floor).
   *
   * Use cases: geometric mean, distance calculations.
   */
  public squareRoot() {
    this.value = sqrt(this.value);
  }

  /**
   * Replaces the stored value with gcd(value, other) — the greatest
   * common divisor.
   *
   * Use cases: fraction simplification, coprimality checks.
   */
  public reduceGcd(other: bigint) {
    this.value = gcd(this.value, other);
  }

  /**
   * Computes \`(value * numerator) / denominator\` with intermediate precision
   * to avoid overflow. Replaces the stored value with the result.
   *
   * Use cases: currency conversion, proportional allocation, token swaps.
   */
  public scaleByRatio(numerator: bigint, denominator: bigint) {
    this.value = mulDiv(this.value, numerator, denominator);
  }

  /**
   * Replaces the stored value with floor(log2(value)) — the floor of the
   * base-2 logarithm.
   *
   * Use cases: bit-length calculation, binary search depth.
   */
  public computeLog2() {
    this.value = log2(this.value);
  }
}
`,
    constructorArgs: {
      value: 100n,
    },
    methodCall: {
      method: 'divideBy',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Demonstrates every built-in math function: safediv, percentOf, clamp, pow, sqrt, gcd, and more.',
  },
  {
    id: 'sol-math-demo',
    name: 'Math Demo (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title MathDemo
/// @notice A stateful contract demonstrating every built-in math function
/// available in Rúnar.
/// @dev Bitcoin Script has limited native arithmetic (ADD, SUB, MUL, DIV, MOD).
/// Rúnar provides higher-level math functions that compile into sequences of
/// these primitives, enabling complex financial calculations on-chain.
///
/// Each public method applies one math operation to the contract's stored
/// \`value\`, showing how these functions compile to pure Bitcoin Script.
/// All operations use integer math — no floating point.
///
/// This contract is intentionally minimal: no signature checks are performed,
/// so any caller can invoke any method. In production, you would combine these
/// math operations with authentication logic.
contract MathDemo is StatefulSmartContract {
    bigint value;

    constructor(bigint _value) {
        value = _value;
    }

    /// @notice Safe division — divides the stored value by \`divisor\`, asserting
    /// that \`divisor\` is non-zero. The transaction fails if divisor is 0.
    /// @dev Use cases: splitting payments, computing averages.
    /// @param divisor The non-zero value to divide by
    function divideBy(bigint divisor) public {
        this.value = safediv(this.value, divisor);
    }

    /// @notice Withdraw with a fee calculated in basis points (1 bps = 0.01%).
    /// percentOf(amount, feeBps) computes amount * feeBps / 10000.
    /// Asserts that the total (amount + fee) does not exceed the stored value.
    /// @dev Use cases: fee calculation, royalties, commission deductions.
    /// @param amount The withdrawal amount
    /// @param feeBps The fee in basis points (e.g. 250 = 2.5%)
    function withdrawWithFee(bigint amount, bigint feeBps) public {
        bigint fee = percentOf(amount, feeBps);
        bigint total = amount + fee;
        require(total <= this.value);
        this.value = this.value - total;
    }

    /// @notice Constrains the stored value to the range [lo, hi].
    /// If value < lo, it becomes lo. If value > hi, it becomes hi.
    /// @dev Use cases: enforcing min/max limits on bids, prices, or balances.
    /// @param lo The lower bound (inclusive)
    /// @param hi The upper bound (inclusive)
    function clampValue(bigint lo, bigint hi) public {
        this.value = clamp(this.value, lo, hi);
    }

    /// @notice Replaces the stored value with its sign: -1, 0, or 1.
    /// @dev Use cases: direction detection, comparison results, branch selection.
    function normalize() public {
        this.value = sign(this.value);
    }

    /// @notice Raises the stored value to the power \`exp\` (integer exponentiation).
    /// @dev Use cases: compound interest, polynomial evaluation.
    /// @param exp The exponent
    function exponentiate(bigint exp) public {
        this.value = pow(this.value, exp);
    }

    /// @notice Replaces the stored value with its integer square root (floor).
    /// @dev Use cases: geometric mean, distance calculations.
    function squareRoot() public {
        this.value = sqrt(this.value);
    }

    /// @notice Replaces the stored value with gcd(value, other) — the greatest
    /// common divisor.
    /// @dev Use cases: fraction simplification, coprimality checks.
    /// @param other The second operand for the GCD computation
    function reduceGcd(bigint other) public {
        this.value = gcd(this.value, other);
    }

    /// @notice Computes (value * numerator) / denominator with intermediate
    /// precision to avoid overflow. Replaces the stored value with the result.
    /// @dev Use cases: currency conversion, proportional allocation, token swaps.
    /// @param numerator The multiplier
    /// @param denominator The divisor (must be non-zero)
    function scaleByRatio(bigint numerator, bigint denominator) public {
        this.value = mulDiv(this.value, numerator, denominator);
    }

    /// @notice Replaces the stored value with floor(log2(value)) — the floor
    /// of the base-2 logarithm.
    /// @dev Use cases: bit-length calculation, binary search depth.
    function computeLog2() public {
        this.value = log2(this.value);
    }
}
`,
    constructorArgs: {
      value: 100n,
    },
    methodCall: {
      method: 'divideBy',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Demonstrates every built-in math function: safediv, percentOf, clamp, pow, sqrt, gcd, and more.',
  },
  {
    id: 'move-math-demo',
    name: 'Math Demo (Move)',
    language: 'move',
    source: `// MathDemo — A stateful contract demonstrating every built-in math function
// available in Rúnar.
//
// Bitcoin Script has limited native arithmetic (ADD, SUB, MUL, DIV, MOD).
// Rúnar provides higher-level math functions that compile into sequences of
// these primitives, enabling complex financial calculations on-chain.
//
// Each public method applies one math operation to the contract's stored
// \`value\`, showing how these functions compile to pure Bitcoin Script.
// All operations use integer math — no floating point.
//
// This contract is intentionally minimal: no signature checks are performed,
// so any caller can invoke any method. In production, you would combine these
// math operations with authentication logic.
module MathDemo {
    resource struct MathDemo {
        value: bigint,
    }

    // Safe division — divides the stored value by \`divisor\`, asserting that
    // \`divisor\` is non-zero. The transaction fails if divisor is 0.
    //
    // Use cases: splitting payments, computing averages.
    public fun divide_by(contract: &mut MathDemo, divisor: bigint) {
        contract.value = safediv(contract.value, divisor);
    }

    // Withdraw with a fee calculated in basis points (1 bps = 0.01%).
    // percentOf(amount, fee_bps) computes amount * fee_bps / 10000.
    // Asserts that the total (amount + fee) does not exceed the stored value.
    //
    // Use cases: fee calculation, royalties, commission deductions.
    public fun withdraw_with_fee(contract: &mut MathDemo, amount: bigint, fee_bps: bigint) {
        let fee: bigint = percentOf(amount, fee_bps);
        let total: bigint = amount + fee;
        assert!(total <= contract.value, 0);
        contract.value = contract.value - total;
    }

    // Constrains the stored value to the range [lo, hi].
    // If value < lo, it becomes lo. If value > hi, it becomes hi.
    //
    // Use cases: enforcing min/max limits on bids, prices, or balances.
    public fun clamp_value(contract: &mut MathDemo, lo: bigint, hi: bigint) {
        contract.value = clamp(contract.value, lo, hi);
    }

    // Replaces the stored value with its sign: -1, 0, or 1.
    //
    // Use cases: direction detection, comparison results, branch selection.
    public fun normalize(contract: &mut MathDemo) {
        contract.value = sign(contract.value);
    }

    // Raises the stored value to the power \`exp\` (integer exponentiation).
    //
    // Use cases: compound interest, polynomial evaluation.
    public fun exponentiate(contract: &mut MathDemo, exp: bigint) {
        contract.value = pow(contract.value, exp);
    }

    // Replaces the stored value with its integer square root (floor).
    //
    // Use cases: geometric mean, distance calculations.
    public fun square_root(contract: &mut MathDemo) {
        contract.value = sqrt(contract.value);
    }

    // Replaces the stored value with gcd(value, other) — the greatest
    // common divisor.
    //
    // Use cases: fraction simplification, coprimality checks.
    public fun reduce_gcd(contract: &mut MathDemo, other: bigint) {
        contract.value = gcd(contract.value, other);
    }

    // Computes (value * numerator) / denominator with intermediate precision
    // to avoid overflow. Replaces the stored value with the result.
    //
    // Use cases: currency conversion, proportional allocation, token swaps.
    public fun scale_by_ratio(contract: &mut MathDemo, numerator: bigint, denominator: bigint) {
        contract.value = mulDiv(contract.value, numerator, denominator);
    }

    // Replaces the stored value with floor(log2(value)) — the floor of the
    // base-2 logarithm.
    //
    // Use cases: bit-length calculation, binary search depth.
    public fun compute_log2(contract: &mut MathDemo) {
        contract.value = log2(contract.value);
    }
}
`,
    constructorArgs: {
      value: 100n,
    },
    methodCall: {
      method: 'divideBy',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Demonstrates every built-in math function: safediv, percentOf, clamp, pow, sqrt, gcd, and more.',
  },
  {
    id: 'go-math-demo',
    name: 'Math Demo (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// MathDemo is a stateful contract demonstrating every built-in math function
// available in Rúnar.
//
// Bitcoin Script has limited native arithmetic (ADD, SUB, MUL, DIV, MOD).
// Rúnar provides higher-level math functions that compile into sequences of
// these primitives, enabling complex financial calculations on-chain.
//
// Each public method applies one math operation to the contract's stored
// Value, showing how these functions compile to pure Bitcoin Script.
// All operations use integer math — no floating point.
//
// This contract is intentionally minimal: no signature checks are performed,
// so any caller can invoke any method. In production, you would combine these
// math operations with authentication logic.
type MathDemo struct {
	runar.StatefulSmartContract
	Value runar.Bigint
}

// DivideBy performs safe division — divides the stored value by divisor,
// asserting that divisor is non-zero. The transaction fails if divisor is 0.
//
// Use cases: splitting payments, computing averages.
func (c *MathDemo) DivideBy(divisor runar.Bigint) {
	c.Value = runar.Safediv(c.Value, divisor)
}

// WithdrawWithFee withdraws with a fee calculated in basis points
// (1 bps = 0.01%). PercentOf(amount, feeBps) computes
// amount * feeBps / 10000. Asserts that the total (amount + fee) does not
// exceed the stored value.
//
// Use cases: fee calculation, royalties, commission deductions.
func (c *MathDemo) WithdrawWithFee(amount, feeBps runar.Bigint) {
	fee := runar.PercentOf(amount, feeBps)
	total := amount + fee
	runar.Assert(total <= c.Value)
	c.Value = c.Value - total
}

// ClampValue constrains the stored value to the range [lo, hi].
// If value < lo, it becomes lo. If value > hi, it becomes hi.
//
// Use cases: enforcing min/max limits on bids, prices, or balances.
func (c *MathDemo) ClampValue(lo, hi runar.Bigint) {
	c.Value = runar.Clamp(c.Value, lo, hi)
}

// Normalize replaces the stored value with its sign: -1, 0, or 1.
//
// Use cases: direction detection, comparison results, branch selection.
func (c *MathDemo) Normalize() {
	c.Value = runar.Sign(c.Value)
}

// Exponentiate raises the stored value to the power exp (integer
// exponentiation).
//
// Use cases: compound interest, polynomial evaluation.
func (c *MathDemo) Exponentiate(exp runar.Bigint) {
	c.Value = runar.Pow(c.Value, exp)
}

// SquareRoot replaces the stored value with its integer square root (floor).
//
// Use cases: geometric mean, distance calculations.
func (c *MathDemo) SquareRoot() {
	c.Value = runar.Sqrt(c.Value)
}

// ReduceGcd replaces the stored value with gcd(value, other) — the greatest
// common divisor.
//
// Use cases: fraction simplification, coprimality checks.
func (c *MathDemo) ReduceGcd(other runar.Bigint) {
	c.Value = runar.Gcd(c.Value, other)
}

// ScaleByRatio computes (value * numerator) / denominator with intermediate
// precision to avoid overflow. Replaces the stored value with the result.
//
// Use cases: currency conversion, proportional allocation, token swaps.
func (c *MathDemo) ScaleByRatio(numerator, denominator runar.Bigint) {
	c.Value = runar.MulDiv(c.Value, numerator, denominator)
}

// ComputeLog2 replaces the stored value with floor(log2(value)) — the floor
// of the base-2 logarithm.
//
// Use cases: bit-length calculation, binary search depth.
func (c *MathDemo) ComputeLog2() {
	c.Value = runar.Log2(c.Value)
}
`,
    constructorArgs: {
      value: 100n,
    },
    methodCall: {
      method: 'divideBy',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Demonstrates every built-in math function: safediv, percentOf, clamp, pow, sqrt, gcd, and more.',
  },
  {
    id: 'rust-math-demo',
    name: 'Math Demo (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// MathDemo — A stateful contract demonstrating every built-in math function
/// available in Rúnar.
///
/// Bitcoin Script has limited native arithmetic (ADD, SUB, MUL, DIV, MOD).
/// Rúnar provides higher-level math functions that compile into sequences of
/// these primitives, enabling complex financial calculations on-chain.
///
/// Each public method applies one math operation to the contract's stored
/// \`value\`, showing how these functions compile to pure Bitcoin Script.
/// All operations use integer math — no floating point.
///
/// This contract is intentionally minimal: no signature checks are performed,
/// so any caller can invoke any method. In production, you would combine these
/// math operations with authentication logic.
#[runar::contract]
pub struct MathDemo {
    pub value: Bigint,
}

#[runar::methods(MathDemo)]
impl MathDemo {
    /// Safe division — divides the stored value by \`divisor\`, asserting that
    /// \`divisor\` is non-zero. The transaction fails if divisor is 0.
    ///
    /// Use cases: splitting payments, computing averages.
    #[public]
    pub fn divide_by(&mut self, divisor: Bigint) {
        self.value = safediv(self.value, divisor);
    }

    /// Withdraw with a fee calculated in basis points (1 bps = 0.01%).
    /// \`percent_of(amount, fee_bps)\` computes \`amount * fee_bps / 10000\`.
    /// Asserts that the total (amount + fee) does not exceed the stored value.
    ///
    /// Use cases: fee calculation, royalties, commission deductions.
    #[public]
    pub fn withdraw_with_fee(&mut self, amount: Bigint, fee_bps: Bigint) {
        let fee = percent_of(amount, fee_bps);
        let total = amount + fee;
        assert!(total <= self.value);
        self.value = self.value - total;
    }

    /// Constrains the stored value to the range [lo, hi].
    /// If value < lo, it becomes lo. If value > hi, it becomes hi.
    ///
    /// Use cases: enforcing min/max limits on bids, prices, or balances.
    #[public]
    pub fn clamp_value(&mut self, lo: Bigint, hi: Bigint) {
        self.value = clamp(self.value, lo, hi);
    }

    /// Replaces the stored value with its sign: -1, 0, or 1.
    ///
    /// Use cases: direction detection, comparison results, branch selection.
    #[public]
    pub fn normalize(&mut self) {
        self.value = sign(self.value);
    }

    /// Raises the stored value to the power \`exp\` (integer exponentiation).
    ///
    /// Use cases: compound interest, polynomial evaluation.
    #[public]
    pub fn exponentiate(&mut self, exp: Bigint) {
        self.value = pow(self.value, exp);
    }

    /// Replaces the stored value with its integer square root (floor).
    ///
    /// Use cases: geometric mean, distance calculations.
    #[public]
    pub fn square_root(&mut self) {
        self.value = sqrt(self.value);
    }

    /// Replaces the stored value with gcd(value, other) — the greatest
    /// common divisor.
    ///
    /// Use cases: fraction simplification, coprimality checks.
    #[public]
    pub fn reduce_gcd(&mut self, other: Bigint) {
        self.value = gcd(self.value, other);
    }

    /// Computes \`(value * numerator) / denominator\` with intermediate precision
    /// to avoid overflow. Replaces the stored value with the result.
    ///
    /// Use cases: currency conversion, proportional allocation, token swaps.
    #[public]
    pub fn scale_by_ratio(&mut self, numerator: Bigint, denominator: Bigint) {
        self.value = mul_div(self.value, numerator, denominator);
    }

    /// Replaces the stored value with floor(log2(value)) — the floor of the
    /// base-2 logarithm.
    ///
    /// Use cases: bit-length calculation, binary search depth.
    #[public]
    pub fn compute_log2(&mut self) {
        self.value = log2(self.value);
    }
}
`,
    constructorArgs: {
      value: 100n,
    },
    methodCall: {
      method: 'divideBy',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Demonstrates every built-in math function: safediv, percentOf, clamp, pow, sqrt, gcd, and more.',
  },
  {
    id: 'python-math-demo',
    name: 'Math Demo (Python)',
    language: 'python',
    source: `"""
MathDemo -- A stateful contract demonstrating every built-in math function
available in Runar.

Bitcoin Script has limited native arithmetic (ADD, SUB, MUL, DIV, MOD).
Runar provides higher-level math functions that compile into sequences of
these primitives, enabling complex financial calculations on-chain.

Each public method applies one math operation to the contract's stored
\`\`value\`\`, showing how these functions compile to pure Bitcoin Script.
All operations use integer math -- no floating point.

This contract is intentionally minimal: no signature checks are performed,
so any caller can invoke any method. In production, you would combine these
math operations with authentication logic.
"""

from runar import (
    StatefulSmartContract, Bigint, public, assert_,
    safediv, percent_of, clamp, sign, pow_, sqrt, gcd, mul_div, log2,
)

class MathDemo(StatefulSmartContract):
    """Stateful contract that stores a single mutable \`\`value\`\` and exposes
    one public method per built-in math function."""

    value: Bigint

    def __init__(self, value: Bigint):
        super().__init__(value)
        self.value = value

    @public
    def divide_by(self, divisor: Bigint):
        """Safe division -- divides the stored value by \`\`divisor\`\`, asserting
        that \`\`divisor\`\` is non-zero. The transaction fails if divisor is 0.

        Use cases: splitting payments, computing averages.
        """
        self.value = safediv(self.value, divisor)

    @public
    def withdraw_with_fee(self, amount: Bigint, fee_bps: Bigint):
        """Withdraw with a fee calculated in basis points (1 bps = 0.01%).
        \`\`percent_of(amount, fee_bps)\`\` computes \`\`amount * fee_bps / 10000\`\`.
        Asserts that the total (amount + fee) does not exceed the stored value.

        Use cases: fee calculation, royalties, commission deductions.
        """
        fee = percent_of(amount, fee_bps)
        total = amount + fee
        assert_(total <= self.value)
        self.value = self.value - total

    @public
    def clamp_value(self, lo: Bigint, hi: Bigint):
        """Constrains the stored value to the range [lo, hi].
        If value < lo, it becomes lo. If value > hi, it becomes hi.

        Use cases: enforcing min/max limits on bids, prices, or balances.
        """
        self.value = clamp(self.value, lo, hi)

    @public
    def normalize(self):
        """Replaces the stored value with its sign: -1, 0, or 1.

        Use cases: direction detection, comparison results, branch selection.
        """
        self.value = sign(self.value)

    @public
    def exponentiate(self, exp: Bigint):
        """Raises the stored value to the power \`\`exp\`\` (integer exponentiation).

        Use cases: compound interest, polynomial evaluation.
        """
        self.value = pow_(self.value, exp)

    @public
    def square_root(self):
        """Replaces the stored value with its integer square root (floor).

        Use cases: geometric mean, distance calculations.
        """
        self.value = sqrt(self.value)

    @public
    def reduce_gcd(self, other: Bigint):
        """Replaces the stored value with gcd(value, other) -- the greatest
        common divisor.

        Use cases: fraction simplification, coprimality checks.
        """
        self.value = gcd(self.value, other)

    @public
    def scale_by_ratio(self, numerator: Bigint, denominator: Bigint):
        """Computes \`\`(value * numerator) / denominator\`\` with intermediate
        precision to avoid overflow. Replaces the stored value with the result.

        Use cases: currency conversion, proportional allocation, token swaps.
        """
        self.value = mul_div(self.value, numerator, denominator)

    @public
    def compute_log2(self):
        """Replaces the stored value with floor(log2(value)) -- the floor of
        the base-2 logarithm.

        Use cases: bit-length calculation, binary search depth.
        """
        self.value = log2(self.value)
`,
    constructorArgs: {
      value: 100n,
    },
    methodCall: {
      method: 'divideBy',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Demonstrates every built-in math function: safediv, percentOf, clamp, pow, sqrt, gcd, and more.',
  },
  {
    id: 'zig-math-demo',
    name: 'Math Demo (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const MathDemo = struct {
    pub const Contract = runar.StatefulSmartContract;

    value: i64 = 0,

    pub fn init(value: i64) MathDemo {
        return .{ .value = value };
    }

    pub fn divideBy(self: *MathDemo, divisor: i64) void {
        self.value = runar.safediv(self.value, divisor);
    }

    pub fn withdrawWithFee(self: *MathDemo, amount: i64, feeBps: i64) void {
        const fee = runar.percentOf(amount, feeBps);
        const total = amount + fee;
        runar.assert(total <= self.value);
        self.value = self.value - total;
    }

    pub fn clampValue(self: *MathDemo, lo: i64, hi: i64) void {
        self.value = runar.clamp(self.value, lo, hi);
    }

    pub fn normalize(self: *MathDemo) void {
        self.value = runar.sign(self.value);
    }

    pub fn exponentiate(self: *MathDemo, exp: i64) void {
        self.value = runar.pow(self.value, exp);
    }

    pub fn squareRoot(self: *MathDemo) void {
        self.value = runar.sqrt(self.value);
    }

    pub fn reduceGcd(self: *MathDemo, other: i64) void {
        self.value = runar.gcd(self.value, other);
    }

    pub fn scaleByRatio(self: *MathDemo, numerator: i64, denominator: i64) void {
        self.value = runar.mulDiv(self.value, numerator, denominator);
    }

    pub fn computeLog2(self: *MathDemo) void {
        self.value = runar.log2(self.value);
    }
};
`,
    constructorArgs: {
      value: 100n,
    },
    methodCall: {
      method: 'divideBy',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Demonstrates every built-in math function: safediv, percentOf, clamp, pow, sqrt, gcd, and more.',
  },
  {
    id: 'ruby-math-demo',
    name: 'Math Demo (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class MathDemo < Runar::StatefulSmartContract
  prop :value, Bigint

  def initialize(value)
    super(value)
    @value = value
  end

  runar_public divisor: Bigint
  def divide_by(divisor)
    @value = safediv(@value, divisor)
  end

  runar_public amount: Bigint, fee_bps: Bigint
  def withdraw_with_fee(amount, fee_bps)
    fee = percent_of(amount, fee_bps)
    total = amount + fee
    assert total <= @value
    @value = @value - total
  end

  runar_public lo: Bigint, hi: Bigint
  def clamp_value(lo, hi)
    @value = clamp(@value, lo, hi)
  end

  runar_public
  def normalize
    @value = sign(@value)
  end

  runar_public exp: Bigint
  def exponentiate(exp)
    @value = pow(@value, exp)
  end

  runar_public
  def square_root
    @value = sqrt(@value)
  end

  runar_public other: Bigint
  def reduce_gcd(other)
    @value = gcd(@value, other)
  end

  runar_public numerator: Bigint, denominator: Bigint
  def scale_by_ratio(numerator, denominator)
    @value = mul_div(@value, numerator, denominator)
  end

  runar_public
  def compute_log2
    @value = log2(@value)
  end
end
`,
    constructorArgs: {
      value: 100n,
    },
    methodCall: {
      method: 'divideBy',
      args: [
        { type: 'bigint', value: '5' },
      ],
    },
    description: 'Demonstrates every built-in math function: safediv, percentOf, clamp, pow, sqrt, gcd, and more.',
  },
  {
    id: 'message-board',
    name: 'Message Board',
    language: 'typescript',
    source: `import { StatefulSmartContract, assert, checkSig } from 'runar-lang';
import type { PubKey, Sig, ByteString } from 'runar-lang';

/**
 * MessageBoard -- a stateful smart contract with a ByteString mutable state field.
 *
 * Demonstrates Runar's ByteString state management: a message that persists
 * and can be updated across spending transactions on the Bitcoin SV blockchain.
 *
 * Because this class extends {@link StatefulSmartContract} (not SmartContract),
 * the compiler automatically injects:
 *   - \`checkPreimage\` at each public method entry -- verifies the spending
 *     transaction matches the sighash preimage.
 *   - State continuation at each public method exit -- serializes updated
 *     state into the new output script.
 *
 * **Script layout (on-chain):**
 * \`\`\`
 * Locking: <contract logic> OP_RETURN <message> <owner>
 * \`\`\`
 * The state (\`message\`) is serialized as push data after OP_RETURN. The
 * \`owner\` is readonly and baked into the locking script. When spent,
 * the compiler-injected preimage check ensures the new output carries the
 * correct updated state.
 *
 * **Authorization:** The \`post\` method has no access control -- anyone can
 * update the message. The \`burn\` method requires the owner's signature to
 * permanently destroy the contract (no continuation output).
 *
 * @param message - The current message stored on-chain (mutable ByteString)
 * @param owner   - The contract owner's compressed public key (readonly)
 */
class MessageBoard extends StatefulSmartContract {
  /** The current message. Mutable -- updated via \`post\`. */
  message: ByteString;
  /** The contract owner's public key. Readonly -- baked into the locking script. */
  readonly owner: PubKey;

  constructor(message: ByteString, owner: PubKey) {
    super(message, owner);
    this.message = message;
    this.owner = owner;
  }

  /**
   * Post a new message, replacing the current one.
   * Anyone can call this method -- no signature required.
   */
  public post(newMessage: ByteString) {
    this.message = newMessage;
  }

  /**
   * Burn the contract -- terminal spend with no continuation output.
   * Only the owner can burn the contract (requires a valid signature).
   */
  public burn(sig: Sig) {
    assert(checkSig(sig, this.owner));
  }
}
`,
    constructorArgs: {
      message: '68656c6c6f',
      owner: ALICE.pubKey,
    },
    methodCall: {
      method: 'post',
      args: [
        { type: 'ByteString', value: '776f726c64' },
      ],
    },
    description: 'Stateful contract with ByteString state. Anyone can post; only owner can burn.',
  },
  {
    id: 'sol-message-board',
    name: 'Message Board (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title MessageBoard
/// @notice A stateful smart contract with a ByteString mutable state field.
/// @dev Demonstrates Runar's ByteString state management: a message that
/// persists and can be updated across spending transactions on the Bitcoin SV
/// blockchain.
///
/// Because this contract inherits StatefulSmartContract, the compiler
/// automatically injects:
///   - \`checkPreimage\` at each public function entry -- verifies the spending
///     transaction matches the sighash preimage.
///   - State continuation at each public function exit -- serializes updated
///     state into the new output script.
///
/// Script layout (on-chain):
///   Locking: <contract logic> OP_RETURN <message> <owner>
///
/// The state (\`message\`) is serialized as push data after OP_RETURN. The
/// \`owner\` is readonly and baked into the locking script.
///
/// Authorization: \`post\` has no access control -- anyone can update the
/// message. \`burn\` requires the owner's signature to permanently destroy
/// the contract (no continuation output).
contract MessageBoard is StatefulSmartContract {
    ByteString message;         // mutable (stateful, persists across transactions)
    PubKey immutable owner;     // readonly -- baked into the locking script

    constructor(ByteString _message, PubKey _owner) {
        message = _message;
        owner = _owner;
    }

    /// @notice Post a new message, replacing the current one. Anyone can call.
    function post(ByteString newMessage) public {
        this.message = newMessage;
    }

    /// @notice Burn the contract -- terminal spend with no continuation output.
    /// @dev Only the owner can burn the contract (requires a valid signature).
    function burn(Sig sig) public {
        require(checkSig(sig, this.owner));
    }
}
`,
    constructorArgs: {
      message: '68656c6c6f',
      owner: ALICE.pubKey,
    },
    methodCall: {
      method: 'post',
      args: [
        { type: 'ByteString', value: '776f726c64' },
      ],
    },
    description: 'Stateful contract with ByteString state. Anyone can post; only owner can burn.',
  },
  {
    id: 'move-message-board',
    name: 'Message Board (Move)',
    language: 'move',
    source: `// MessageBoard -- a stateful smart contract with a ByteString mutable state field.
//
// Demonstrates Runar's ByteString state management: a message that persists
// and can be updated across spending transactions on the Bitcoin SV blockchain.
//
// Because MessageBoard is declared as a \`resource struct\`, the compiler
// automatically injects:
//   - checkPreimage at each public function entry -- verifies the spending
//     transaction matches the sighash preimage.
//   - State continuation at each public function exit -- serializes updated
//     state into the new output script.
//
// Script layout (on-chain):
//   Locking: <contract logic> OP_RETURN <message> <owner>
//
// The state (message) is serialized as push data after OP_RETURN. The
// owner is readonly and baked into the locking script.
//
// Authorization: post has no access control -- anyone can update the
// message. burn requires the owner's signature to permanently destroy
// the contract (no continuation output).
module MessageBoard {
    use runar::types::{PubKey, Sig, ByteString};
    use runar::crypto::{check_sig};

    resource struct MessageBoard {
        message: ByteString,   // mutable (stateful, persists across transactions)
        owner: PubKey,         // readonly -- baked into the locking script
    }

    // Post a new message, replacing the current one. Anyone can call.
    public fun post(contract: &mut MessageBoard, new_message: ByteString) {
        contract.message = new_message;
    }

    // Burn the contract -- terminal spend with no continuation output.
    // Only the owner can burn the contract (requires a valid signature).
    public fun burn(contract: &MessageBoard, sig: Sig) {
        assert!(check_sig(sig, contract.owner), 0);
    }
}
`,
    constructorArgs: {
      message: '68656c6c6f',
      owner: ALICE.pubKey,
    },
    methodCall: {
      method: 'post',
      args: [
        { type: 'ByteString', value: '776f726c64' },
      ],
    },
    description: 'Stateful contract with ByteString state. Anyone can post; only owner can burn.',
  },
  {
    id: 'go-message-board',
    name: 'Message Board (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// MessageBoard -- a stateful smart contract with a ByteString mutable state field.
//
// Demonstrates Runar's ByteString state management: a message that persists
// and can be updated across spending transactions on the Bitcoin SV blockchain.
//
// Because this struct embeds runar.StatefulSmartContract, the compiler
// automatically injects:
//   - checkPreimage at each public method entry -- verifies the spending
//     transaction matches the sighash preimage.
//   - State continuation at each public method exit -- serializes updated
//     state into the new output script.
//
// Script layout (on-chain):
//
//	Locking: <contract logic> OP_RETURN <message> <owner>
//
// The state (Message) is serialized as push data after OP_RETURN. The
// Owner is readonly and baked into the locking script.
//
// Authorization: Post has no access control -- anyone can update the
// message. Burn requires the owner's signature to permanently destroy
// the contract (no continuation output).
type MessageBoard struct {
	runar.StatefulSmartContract
	Message runar.ByteString              // no tag = mutable (stateful, persists across transactions)
	Owner   runar.PubKey \`runar:"readonly"\` // readonly -- baked into the locking script
}

// Post replaces the current message with a new one. Anyone can call this method.
func (c *MessageBoard) Post(newMessage runar.ByteString) {
	c.Message = newMessage
}

// Burn permanently destroys the contract -- terminal spend with no continuation output.
// Only the owner can burn the contract (requires a valid signature).
func (c *MessageBoard) Burn(sig runar.Sig) {
	runar.Assert(runar.CheckSig(sig, c.Owner))
}
`,
    constructorArgs: {
      message: '68656c6c6f',
      owner: ALICE.pubKey,
    },
    methodCall: {
      method: 'post',
      args: [
        { type: 'ByteString', value: '776f726c64' },
      ],
    },
    description: 'Stateful contract with ByteString state. Anyone can post; only owner can burn.',
  },
  {
    id: 'rust-message-board',
    name: 'Message Board (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// MessageBoard -- a stateful smart contract with a ByteString mutable state field.
///
/// Demonstrates Runar's ByteString state management: a message that persists
/// and can be updated across spending transactions on the Bitcoin SV blockchain.
///
/// Because this struct uses \`#[runar::contract]\`, the compiler automatically
/// injects:
///   - \`checkPreimage\` at each public method entry -- verifies the spending
///     transaction matches the sighash preimage.
///   - State continuation at each public method exit -- serializes updated
///     state into the new output script.
///
/// **Script layout (on-chain):**
/// \`\`\`text
/// Locking: <contract logic> OP_RETURN <message> <owner>
/// \`\`\`
/// The state (\`message\`) is serialized as push data after \`OP_RETURN\`. The
/// \`owner\` is readonly and baked into the locking script.
///
/// **Authorization:** \`post\` has no access control -- anyone can update the
/// message. \`burn\` requires the owner's signature to permanently destroy
/// the contract (no continuation output).
#[runar::contract]
pub struct MessageBoard {
    /// The current message. Mutable -- updated via \`post\`.
    pub message: ByteString,
    /// The contract owner's public key. Readonly -- baked into the locking script.
    #[readonly]
    pub owner: PubKey,
}

#[runar::methods(MessageBoard)]
impl MessageBoard {
    /// Post a new message, replacing the current one. Anyone can call.
    #[public]
    pub fn post(&mut self, new_message: ByteString) {
        self.message = new_message;
    }

    /// Burn the contract -- terminal spend with no continuation output.
    /// Only the owner can burn the contract (requires a valid signature).
    #[public]
    pub fn burn(&self, sig: &Sig) {
        assert!(check_sig(sig, &self.owner));
    }
}
`,
    constructorArgs: {
      message: '68656c6c6f',
      owner: ALICE.pubKey,
    },
    methodCall: {
      method: 'post',
      args: [
        { type: 'ByteString', value: '776f726c64' },
      ],
    },
    description: 'Stateful contract with ByteString state. Anyone can post; only owner can burn.',
  },
  {
    id: 'python-message-board',
    name: 'Message Board (Python)',
    language: 'python',
    source: `from runar import (
    StatefulSmartContract, PubKey, Sig, ByteString, Readonly,
    public, assert_, check_sig,
)


class MessageBoard(StatefulSmartContract):
    """MessageBoard -- a stateful smart contract with a ByteString mutable state field.

    Demonstrates Runar's ByteString state management: a message that persists
    and can be updated across spending transactions on the Bitcoin SV blockchain.

    Because this class extends StatefulSmartContract, the compiler automatically
    injects:
      - checkPreimage at each public method entry -- verifies the spending
        transaction matches the sighash preimage.
      - State continuation at each public method exit -- serializes updated
        state into the new output script.

    Script layout (on-chain)::

        Locking: <contract logic> OP_RETURN <message> <owner>

    The state (message) is serialized as push data after OP_RETURN. The
    owner is readonly and baked into the locking script.

    Authorization: post has no access control -- anyone can update the
    message. burn requires the owner's signature to permanently destroy
    the contract (no continuation output).

    Args:
        message: The current message stored on-chain (mutable ByteString).
        owner:   The contract owner's compressed public key (readonly).
    """

    message: ByteString            # mutable (stateful, persists across transactions)
    owner: Readonly[PubKey]        # readonly -- baked into the locking script

    def __init__(self, message: ByteString, owner: PubKey):
        super().__init__(message, owner)
        self.message = message
        self.owner = owner

    @public
    def post(self, new_message: ByteString):
        """Post a new message, replacing the current one. Anyone can call."""
        self.message = new_message

    @public
    def burn(self, sig: Sig):
        """Burn the contract -- terminal spend with no continuation output.

        Only the owner can burn the contract (requires a valid signature).

        Args:
            sig: Owner's ECDSA signature.
        """
        assert_(check_sig(sig, self.owner))
`,
    constructorArgs: {
      message: '68656c6c6f',
      owner: ALICE.pubKey,
    },
    methodCall: {
      method: 'post',
      args: [
        { type: 'ByteString', value: '776f726c64' },
      ],
    },
    description: 'Stateful contract with ByteString state. Anyone can post; only owner can burn.',
  },
  {
    id: 'zig-message-board',
    name: 'Message Board (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const MessageBoard = struct {
    pub const Contract = runar.StatefulSmartContract;

    message: runar.ByteString = "",
    owner: runar.PubKey,

    pub fn init(message: runar.ByteString, owner: runar.PubKey) MessageBoard {
        return .{
            .message = message,
            .owner = owner,
        };
    }

    pub fn post(self: *MessageBoard, newMessage: runar.ByteString) void {
        self.message = newMessage;
        runar.assert(true);
    }

    pub fn burn(self: *const MessageBoard, sig: runar.Sig) void {
        runar.assert(runar.checkSig(sig, self.owner));
    }
};
`,
    constructorArgs: {
      message: '68656c6c6f',
      owner: ALICE.pubKey,
    },
    methodCall: {
      method: 'post',
      args: [
        { type: 'ByteString', value: '776f726c64' },
      ],
    },
    description: 'Stateful contract with ByteString state. Anyone can post; only owner can burn.',
  },
  {
    id: 'p2blake3pkh',
    name: 'P2Blake3PKH',
    language: 'typescript',
    source: `import {
  SmartContract,
  assert,
  ByteString,
  PubKey,
  Sig,
  blake3Hash,
  checkSig,
} from 'runar-lang';

/**
 * P2Blake3PKH — Pay-to-Blake3-Public-Key-Hash.
 *
 * A variant of P2PKH that uses BLAKE3 instead of HASH160 (SHA-256 + RIPEMD-160)
 * for public key hashing. BLAKE3 produces a 32-byte digest (vs HASH160's 20 bytes),
 * offering a larger pre-image space and resistance to length-extension attacks.
 *
 * ## How It Works: Two-Step Verification
 *
 *  1. **Hash check** — \`blake3Hash(pubKey) === pubKeyHash\` proves the provided
 *     public key matches the one committed to when the output was created.
 *  2. **Signature check** — \`checkSig(sig, pubKey)\` proves the spender
 *     holds the private key corresponding to that public key.
 *
 * ## Script Layout
 *
 * The compiled Bitcoin Script inlines the BLAKE3 compression function directly
 * into the locking script (~7K–10K ops), unlike P2PKH which uses the single
 * OP_HASH160 opcode.
 *
 * \`\`\`
 * Locking script:
 *   OP_DUP
 *   <blake3 compression inlined — ~7K–10K ops>
 *   <pubKeyHash (32 bytes)>
 *   OP_EQUALVERIFY
 *   OP_CHECKSIG
 *
 * Unlocking script:
 *   <sig> <pubKey>
 * \`\`\`
 *
 * ## Parameter Sizes
 *
 *   - pubKeyHash: 32 bytes (BLAKE3 hash of compressed public key)
 *   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
 *   - pubKey: 33 bytes (compressed secp256k1 public key)
 */
class P2Blake3PKH extends SmartContract {
  readonly pubKeyHash: ByteString;

  constructor(pubKeyHash: ByteString) {
    super(pubKeyHash);
    this.pubKeyHash = pubKeyHash;
  }

  /** Unlock verifies the pubKey hashes to the committed BLAKE3 hash, then checks the signature. */
  public unlock(sig: Sig, pubKey: PubKey) {
    // Step 1: Verify pubKey matches the committed BLAKE3 hash
    assert(blake3Hash(pubKey) === this.pubKeyHash);
    // Step 2: Verify ECDSA signature proves ownership of the private key
    assert(checkSig(sig, pubKey));
  }
}
`,
    constructorArgs: {
      pubKeyHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'P2PKH variant using BLAKE3 instead of HASH160 for public key hashing.',
  },
  {
    id: 'sol-p2blake3pkh',
    name: 'P2Blake3PKH (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title P2Blake3PKH — Pay-to-Blake3-Public-Key-Hash
/// @notice A variant of P2PKH that uses BLAKE3 instead of HASH160 (SHA-256 then
/// RIPEMD-160) for public key hashing. BLAKE3 produces a 32-byte digest (vs
/// HASH160's 20 bytes), offering a larger pre-image space and resistance to
/// length-extension attacks.
///
/// How It Works: Two-Step Verification
///
///  1. Hash check — blake3Hash(pubKey) == pubKeyHash proves the provided public
///     key matches the one committed to when the output was created.
///  2. Signature check — checkSig(sig, pubKey) proves the spender holds the
///     private key corresponding to that public key.
///
/// Script Layout:
///   The compiled Bitcoin Script inlines the BLAKE3 compression function
///   directly into the locking script (~7K-10K ops), unlike P2PKH which
///   uses the single OP_HASH160 opcode.
///
///   Locking script:
///     OP_DUP
///     <blake3 compression inlined — ~7K-10K ops>
///     <pubKeyHash (32 bytes)>
///     OP_EQUALVERIFY
///     OP_CHECKSIG
///
///   Unlocking script:
///     <sig> <pubKey>
///
/// Parameter Sizes:
///   - pubKeyHash: 32 bytes (BLAKE3 hash of compressed public key)
///   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
///   - pubKey: 33 bytes (compressed secp256k1 public key)
contract P2Blake3PKH is SmartContract {
    bytes immutable pubKeyHash;

    constructor(bytes _pubKeyHash) {
        pubKeyHash = _pubKeyHash;
    }

    /// @notice Verify the pubKey hashes to the committed BLAKE3 hash, then check the signature.
    function unlock(Sig sig, PubKey pubKey) public {
        // Step 1: Verify pubKey matches the committed BLAKE3 hash
        require(blake3Hash(pubKey) == pubKeyHash);
        // Step 2: Verify ECDSA signature proves ownership of the private key
        require(checkSig(sig, pubKey));
    }
}
`,
    constructorArgs: {
      pubKeyHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'P2PKH variant using BLAKE3 instead of HASH160 for public key hashing.',
  },
  {
    id: 'move-p2blake3pkh',
    name: 'P2Blake3PKH (Move)',
    language: 'move',
    source: `// P2Blake3PKH — Pay-to-Blake3-Public-Key-Hash.
//
// A variant of P2PKH that uses BLAKE3 instead of HASH160 (SHA-256 then RIPEMD-160)
// for public key hashing. BLAKE3 produces a 32-byte digest (vs HASH160's 20 bytes),
// offering a larger pre-image space and resistance to length-extension attacks.
//
// How It Works: Two-Step Verification
//
//  1. Hash check — blake3_hash(pub_key) == pub_key_hash proves the provided
//     public key matches the one committed to when the output was created.
//  2. Signature check — check_sig(sig, pub_key) proves the spender
//     holds the private key corresponding to that public key.
//
// Script Layout:
//   The compiled Bitcoin Script inlines the BLAKE3 compression function
//   directly into the locking script (~7K-10K ops), unlike P2PKH which
//   uses the single OP_HASH160 opcode.
//
//   Locking script:
//     OP_DUP
//     <blake3 compression inlined — ~7K-10K ops>
//     <pubKeyHash (32 bytes)>
//     OP_EQUALVERIFY
//     OP_CHECKSIG
//
//   Unlocking script:
//     <sig> <pubKey>
//
// Parameter Sizes:
//   - pub_key_hash: 32 bytes (BLAKE3 hash of compressed public key)
//   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
//   - pub_key: 33 bytes (compressed secp256k1 public key)
module P2Blake3PKH {
    use runar::types::{ByteString, PubKey, Sig};
    use runar::crypto::{blake3_hash, check_sig};

    resource struct P2Blake3PKH {
        pub_key_hash: ByteString,
    }

    // Verify the pub_key hashes to the committed BLAKE3 hash, then check the signature.
    public fun unlock(contract: &P2Blake3PKH, sig: Sig, pub_key: PubKey) {
        // Step 1: Verify pub_key matches the committed BLAKE3 hash
        assert!(blake3_hash(pub_key) == contract.pub_key_hash, 0);
        // Step 2: Verify ECDSA signature proves ownership of the private key
        assert!(check_sig(sig, pub_key), 0);
    }
}
`,
    constructorArgs: {
      pubKeyHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'P2PKH variant using BLAKE3 instead of HASH160 for public key hashing.',
  },
  {
    id: 'go-p2blake3pkh',
    name: 'P2Blake3PKH (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// P2Blake3PKH — Pay-to-Blake3-Public-Key-Hash.
//
// A variant of P2PKH that uses BLAKE3 instead of HASH160 (SHA-256 + RIPEMD-160)
// for public key hashing. BLAKE3 produces a 32-byte digest (vs HASH160's 20 bytes),
// offering a larger pre-image space and resistance to length-extension attacks.
//
// # How It Works: Two-Step Verification
//
//  1. Hash check — blake3Hash(pubKey) == pubKeyHash proves the provided
//     public key matches the one committed to when the output was created.
//  2. Signature check — checkSig(sig, pubKey) proves the spender
//     holds the private key corresponding to that public key.
//
// # Script Layout
//
// The compiled Bitcoin Script inlines the BLAKE3 compression function directly
// into the locking script (~7K-10K ops), unlike P2PKH which uses OP_HASH160.
//
//	Locking script:
//	  OP_DUP
//	  <blake3 compression inlined — ~7K-10K ops>
//	  <pubKeyHash (32 bytes)>
//	  OP_EQUALVERIFY
//	  OP_CHECKSIG
//
//	Unlocking script:
//	  <sig> <pubKey>
//
// # Parameter Sizes
//
//   - pubKeyHash: 32 bytes (BLAKE3 hash of compressed public key)
//   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
//   - pubKey: 33 bytes (compressed secp256k1 public key)
type P2Blake3PKH struct {
	runar.SmartContract
	PubKeyHash runar.ByteString \`runar:"readonly"\`
}

// Unlock verifies the pubKey hashes to the committed BLAKE3 hash, then checks the signature.
func (c *P2Blake3PKH) Unlock(sig runar.Sig, pubKey runar.PubKey) {
	// Step 1: Verify pubKey matches the committed BLAKE3 hash
	runar.Assert(runar.Blake3Hash(pubKey) == c.PubKeyHash)
	// Step 2: Verify ECDSA signature proves ownership of the private key
	runar.Assert(runar.CheckSig(sig, pubKey))
}
`,
    constructorArgs: {
      pubKeyHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'P2PKH variant using BLAKE3 instead of HASH160 for public key hashing.',
  },
  {
    id: 'rust-p2blake3pkh',
    name: 'P2Blake3PKH (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// P2Blake3PKH — Pay-to-Blake3-Public-Key-Hash.
///
/// A variant of P2PKH that uses BLAKE3 instead of HASH160 (SHA-256 + RIPEMD-160)
/// for public key hashing. BLAKE3 produces a 32-byte digest (vs HASH160's 20 bytes),
/// offering a larger pre-image space and resistance to length-extension attacks.
///
/// # How It Works: Two-Step Verification
///
///  1. **Hash check** — \`blake3_hash(pub_key) == pub_key_hash\` proves the provided
///     public key matches the one committed to when the output was created.
///  2. **Signature check** — \`check_sig(sig, pub_key)\` proves the spender
///     holds the private key corresponding to that public key.
///
/// # Script Layout
///
/// The compiled Bitcoin Script inlines the BLAKE3 compression function directly
/// into the locking script (~7K-10K ops), unlike P2PKH which uses OP_HASH160.
///
/// \`\`\`text
/// Locking script:
///   OP_DUP
///   <blake3 compression inlined — ~7K-10K ops>
///   <pubKeyHash (32 bytes)>
///   OP_EQUALVERIFY
///   OP_CHECKSIG
///
/// Unlocking script:
///   <sig> <pubKey>
/// \`\`\`
///
/// # Parameter Sizes
///
///   - pub_key_hash: 32 bytes (BLAKE3 hash of compressed public key)
///   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
///   - pub_key: 33 bytes (compressed secp256k1 public key)
#[runar::contract]
pub struct P2Blake3PKH {
    #[readonly]
    pub pub_key_hash: ByteString,
}

#[runar::methods(P2Blake3PKH)]
impl P2Blake3PKH {
    /// Unlock verifies the pub_key hashes to the committed BLAKE3 hash, then checks the signature.
    #[public]
    pub fn unlock(&self, sig: &Sig, pub_key: &PubKey) {
        // Step 1: Verify pub_key matches the committed BLAKE3 hash
        assert!(blake3_hash(pub_key) == self.pub_key_hash);
        // Step 2: Verify ECDSA signature proves ownership of the private key
        assert!(check_sig(sig, pub_key));
    }
}
`,
    constructorArgs: {
      pubKeyHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'P2PKH variant using BLAKE3 instead of HASH160 for public key hashing.',
  },
  {
    id: 'python-p2blake3pkh',
    name: 'P2Blake3PKH (Python)',
    language: 'python',
    source: `from runar import SmartContract, ByteString, Sig, PubKey, public, assert_, blake3_hash, check_sig

class P2Blake3PKH(SmartContract):
    """P2Blake3PKH — Pay-to-Blake3-Public-Key-Hash.

    A variant of P2PKH that uses BLAKE3 instead of HASH160 (SHA-256 then
    RIPEMD-160) for public key hashing. BLAKE3 produces a 32-byte digest
    (vs HASH160's 20 bytes), offering a larger pre-image space and resistance
    to length-extension attacks.

    How It Works: Two-Step Verification

      1. Hash check — blake3_hash(pub_key) == pub_key_hash proves the provided
         public key matches the one committed to when the output was created.
      2. Signature check — check_sig(sig, pub_key) proves the spender
         holds the private key corresponding to that public key.

    Script Layout:
      The compiled Bitcoin Script inlines the BLAKE3 compression function
      directly into the locking script (~7K-10K ops), unlike P2PKH which
      uses the single OP_HASH160 opcode.

      Locking script:
        OP_DUP
        <blake3 compression inlined — ~7K-10K ops>
        <pubKeyHash (32 bytes)>
        OP_EQUALVERIFY
        OP_CHECKSIG

      Unlocking script:
        <sig> <pubKey>

    Parameter Sizes:
      - pub_key_hash: 32 bytes (BLAKE3 hash of compressed public key)
      - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
      - pub_key: 33 bytes (compressed secp256k1 public key)
    """
    pub_key_hash: ByteString

    def __init__(self, pub_key_hash: ByteString):
        super().__init__(pub_key_hash)
        self.pub_key_hash = pub_key_hash

    @public
    def unlock(self, sig: Sig, pub_key: PubKey):
        """Verify the pub_key hashes to the committed BLAKE3 hash, then check the signature."""
        # Step 1: Verify pub_key matches the committed BLAKE3 hash
        assert_(blake3_hash(pub_key) == self.pub_key_hash)
        # Step 2: Verify ECDSA signature proves ownership of the private key
        assert_(check_sig(sig, pub_key))
`,
    constructorArgs: {
      pubKeyHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'P2PKH variant using BLAKE3 instead of HASH160 for public key hashing.',
  },
  {
    id: 'zig-p2blake3pkh',
    name: 'P2Blake3PKH (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const P2Blake3PKH = struct {
    pub const Contract = runar.SmartContract;

    pubKeyHash: runar.ByteString,

    pub fn init(pubKeyHash: runar.ByteString) P2Blake3PKH {
        return .{ .pubKeyHash = pubKeyHash };
    }

    pub fn unlock(self: *const P2Blake3PKH, sig: runar.Sig, pubKey: runar.PubKey) void {
        runar.assert(runar.bytesEq(runar.blake3Hash(pubKey), self.pubKeyHash));
        runar.assert(runar.checkSig(sig, pubKey));
    }
};
`,
    constructorArgs: {
      pubKeyHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'P2PKH variant using BLAKE3 instead of HASH160 for public key hashing.',
  },
  {
    id: 'ruby-p2blake3pkh',
    name: 'P2Blake3PKH (Ruby)',
    language: 'ruby',
    source: `require 'runar'

# P2Blake3PKH -- Pay-to-Blake3-Public-Key-Hash.
#
# A variant of P2PKH that uses BLAKE3 instead of HASH160 (SHA-256 then
# RIPEMD-160) for public key hashing. BLAKE3 produces a 32-byte digest
# (vs HASH160's 20 bytes), offering a larger pre-image space and resistance
# to length-extension attacks.
#
# How It Works: Two-Step Verification
#
#   1. Hash check -- blake3_hash(pub_key) == pub_key_hash proves the provided
#      public key matches the one committed to when the output was created.
#   2. Signature check -- check_sig(sig, pub_key) proves the spender holds
#      the private key corresponding to that public key.
#
# Script Layout:
#   The compiled Bitcoin Script inlines the BLAKE3 compression function
#   directly into the locking script (~7K-10K ops), unlike P2PKH which
#   uses the single OP_HASH160 opcode.
#
#   Locking script:
#     OP_DUP
#     <blake3 compression inlined -- ~7K-10K ops>
#     <pubKeyHash (32 bytes)>
#     OP_EQUALVERIFY
#     OP_CHECKSIG
#
#   Unlocking script:
#     <sig> <pubKey>
#
# Parameter Sizes:
#   - pub_key_hash: 32 bytes (BLAKE3 hash of compressed public key)
#   - sig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
#   - pub_key: 33 bytes (compressed secp256k1 public key)

class P2Blake3PKH < Runar::SmartContract
  prop :pub_key_hash, ByteString

  def initialize(pub_key_hash)
    super(pub_key_hash)
    @pub_key_hash = pub_key_hash
  end

  # Verify the pub_key hashes to the committed BLAKE3 hash, then check the
  # signature.
  #
  # Step 1: blake3_hash(pub_key) == pub_key_hash proves the public key matches
  #         the one committed to at deployment.
  # Step 2: check_sig(sig, pub_key) proves the spender holds the private key.
  runar_public sig: Sig, pub_key: PubKey
  def unlock(sig, pub_key)
    # Step 1: Verify pub_key matches the committed BLAKE3 hash
    assert blake3_hash(pub_key) == @pub_key_hash
    # Step 2: Verify ECDSA signature proves ownership of the private key
    assert check_sig(sig, pub_key)
  end
end
`,
    constructorArgs: {
      pubKeyHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'unlock',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'P2PKH variant using BLAKE3 instead of HASH160 for public key hashing.',
  },
  {
    id: 'post-quantum-wallet',
    name: 'Post-Quantum Wallet (WOTS+)',
    language: 'typescript',
    source: `import { SmartContract, assert, hash160, checkSig, verifyWOTS } from 'runar-lang';
import type { ByteString, Sig, PubKey, Addr } from 'runar-lang';

/**
 * Hybrid ECDSA + WOTS+ Post-Quantum Wallet.
 *
 * ## Security Model: Two-Layer Authentication
 *
 * This contract creates a quantum-resistant spending path by combining
 * classical ECDSA with WOTS+ (Winternitz One-Time Signature):
 *
 * 1. **ECDSA** proves the signature commits to this specific transaction
 *    (via OP_CHECKSIG over the sighash preimage).
 * 2. **WOTS+** proves the ECDSA signature was authorized by the WOTS key
 *    holder — the ECDSA signature bytes ARE the message that WOTS signs.
 *
 * A quantum attacker who can break ECDSA could forge a valid ECDSA
 * signature, but they cannot produce a valid WOTS+ signature over their
 * forged sig without knowing the WOTS secret key. WOTS+ security relies
 * only on SHA-256 collision resistance, not on any number-theoretic
 * assumption vulnerable to Shor's algorithm.
 *
 * ## Locking Script Layout (~10 KB)
 *
 * \`\`\`
 * Unlocking: <wotsSig(2144B)> <wotsPubKey(64B)> <ecdsaSig(~72B)> <ecdsaPubKey(33B)>
 *
 * Locking:
 *   // --- ECDSA verification (P2PKH) ---
 *   OP_OVER OP_TOALTSTACK           // copy ecdsaSig to alt stack for WOTS later
 *   OP_DUP OP_HASH160 <ecdsaPubKeyHash(20B)> OP_EQUALVERIFY OP_CHECKSIG OP_VERIFY
 *   // --- WOTS+ pubkey commitment ---
 *   OP_DUP OP_HASH160 <wotsPubKeyHash(20B)> OP_EQUALVERIFY
 *   // --- WOTS+ verification ---
 *   OP_FROMALTSTACK OP_ROT OP_ROT   // bring ecdsaSig back as WOTS message
 *   <verifyWOTS ~10KB inline>        // verify WOTS+(ecdsaSig, wotsSig, wotsPubKey)
 * \`\`\`
 *
 * ## Stack Trace
 *
 * | Step | Stack (top → bottom) |
 * |------|---------------------|
 * | Start | wotsSig, wotsPK, ecdsaSig, ecdsaPK |
 * | After ECDSA verify | wotsSig, wotsPK |
 * | After WOTS PK hash check | wotsSig, wotsPK |
 * | After WOTS verify | (empty / true) |
 *
 * ## Parameter Sizes
 *
 * - ecdsaPubKeyHash: 20 bytes (HASH160 of compressed ECDSA public key)
 * - wotsPubKeyHash: 20 bytes (HASH160 of 64-byte WOTS+ public key: pubSeed[32] || pkRoot[32])
 * - ecdsaSig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
 * - ecdsaPubKey: 33 bytes (compressed secp256k1 public key)
 * - wotsSig: 2,144 bytes (67 chains x 32 bytes)
 * - wotsPubKey: 64 bytes (pubSeed[32] || pkRoot[32])
 */
class PostQuantumWallet extends SmartContract {
  readonly ecdsaPubKeyHash: Addr;
  readonly wotsPubKeyHash: ByteString;

  constructor(ecdsaPubKeyHash: Addr, wotsPubKeyHash: ByteString) {
    super(ecdsaPubKeyHash, wotsPubKeyHash);
    this.ecdsaPubKeyHash = ecdsaPubKeyHash;
    this.wotsPubKeyHash = wotsPubKeyHash;
  }

  public spend(wotsSig: ByteString, wotsPubKey: ByteString, sig: Sig, pubKey: PubKey) {
    // Step 1: Verify ECDSA — proves sig commits to this transaction
    assert(hash160(pubKey) === this.ecdsaPubKeyHash);
    assert(checkSig(sig, pubKey));

    // Step 2: Verify WOTS+ — proves ECDSA sig was authorized by WOTS key holder
    assert(hash160(wotsPubKey) === this.wotsPubKeyHash);
    assert(verifyWOTS(sig, wotsSig, wotsPubKey));
  }
}
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      wotsPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + WOTS+ post-quantum wallet. Quantum-resistant spending path.',
  },
  {
    id: 'go-post-quantum-wallet',
    name: 'Post-Quantum Wallet (WOTS+) (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// PostQuantumWallet — Hybrid ECDSA + WOTS+ Post-Quantum Wallet.
//
// # Security Model: Two-Layer Authentication
//
// This contract creates a quantum-resistant spending path by combining
// classical ECDSA with WOTS+ (Winternitz One-Time Signature):
//
//  1. ECDSA proves the signature commits to this specific transaction
//     (via OP_CHECKSIG over the sighash preimage).
//  2. WOTS+ proves the ECDSA signature was authorized by the WOTS key
//     holder — the ECDSA signature bytes ARE the message that WOTS signs.
//
// A quantum attacker who can break ECDSA could forge a valid ECDSA
// signature, but they cannot produce a valid WOTS+ signature over their
// forged sig without knowing the WOTS secret key. WOTS+ security relies
// only on SHA-256 collision resistance, not on any number-theoretic
// assumption vulnerable to Shor's algorithm.
//
// # Locking Script Layout (~10 KB)
//
//	Unlocking: <wotsSig(2144B)> <wotsPubKey(64B)> <ecdsaSig(~72B)> <ecdsaPubKey(33B)>
//
//	Locking:
//	  // --- ECDSA verification (P2PKH) ---
//	  OP_OVER OP_TOALTSTACK           // copy ecdsaSig to alt stack for WOTS later
//	  OP_DUP OP_HASH160 <ecdsaPubKeyHash(20B)> OP_EQUALVERIFY OP_CHECKSIG OP_VERIFY
//	  // --- WOTS+ pubkey commitment ---
//	  OP_DUP OP_HASH160 <wotsPubKeyHash(20B)> OP_EQUALVERIFY
//	  // --- WOTS+ verification ---
//	  OP_FROMALTSTACK OP_ROT OP_ROT   // bring ecdsaSig back as WOTS message
//	  <verifyWOTS ~10KB inline>        // verify WOTS+(ecdsaSig, wotsSig, wotsPubKey)
//
// # Stack Trace
//
//	| Step                       | Stack (top -> bottom)                |
//	|----------------------------|--------------------------------------|
//	| Start                      | wotsSig, wotsPK, ecdsaSig, ecdsaPK  |
//	| After ECDSA verify         | wotsSig, wotsPK                      |
//	| After WOTS PK hash check   | wotsSig, wotsPK                      |
//	| After WOTS verify          | (empty / true)                       |
//
// # Parameter Sizes
//
//   - ecdsaPubKeyHash: 20 bytes (HASH160 of compressed ECDSA public key)
//   - wotsPubKeyHash: 20 bytes (HASH160 of 64-byte WOTS+ public key: pubSeed[32] || pkRoot[32])
//   - ecdsaSig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
//   - ecdsaPubKey: 33 bytes (compressed secp256k1 public key)
//   - wotsSig: 2,144 bytes (67 chains x 32 bytes)
//   - wotsPubKey: 64 bytes (pubSeed[32] || pkRoot[32])
type PostQuantumWallet struct {
	runar.SmartContract
	EcdsaPubKeyHash runar.Addr       \`runar:"readonly"\`
	WotsPubKeyHash  runar.ByteString \`runar:"readonly"\`
}

// Spend verifies both ECDSA and WOTS+ signatures to allow spending.
func (c *PostQuantumWallet) Spend(wotsSig runar.ByteString, wotsPubKey runar.ByteString, sig runar.Sig, pubKey runar.PubKey) {
	// Step 1: Verify ECDSA — proves sig commits to this transaction
	runar.Assert(runar.Hash160(pubKey) == c.EcdsaPubKeyHash)
	runar.Assert(runar.CheckSig(sig, pubKey))

	// Step 2: Verify WOTS+ — proves ECDSA sig was authorized by WOTS key holder
	runar.Assert(runar.Hash160(wotsPubKey) == c.WotsPubKeyHash)
	runar.Assert(runar.VerifyWOTS(sig, wotsSig, wotsPubKey))
}
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      wotsPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + WOTS+ post-quantum wallet. Quantum-resistant spending path.',
  },
  {
    id: 'rust-post-quantum-wallet',
    name: 'Post-Quantum Wallet (WOTS+) (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// Hybrid ECDSA + WOTS+ Post-Quantum Wallet.
///
/// # Security Model: Two-Layer Authentication
///
/// This contract creates a quantum-resistant spending path by combining
/// classical ECDSA with WOTS+ (Winternitz One-Time Signature):
///
///  1. **ECDSA** proves the signature commits to this specific transaction
///     (via OP_CHECKSIG over the sighash preimage).
///  2. **WOTS+** proves the ECDSA signature was authorized by the WOTS key
///     holder — the ECDSA signature bytes ARE the message that WOTS signs.
///
/// A quantum attacker who can break ECDSA could forge a valid ECDSA
/// signature, but they cannot produce a valid WOTS+ signature over their
/// forged sig without knowing the WOTS secret key. WOTS+ security relies
/// only on SHA-256 collision resistance, not on any number-theoretic
/// assumption vulnerable to Shor's algorithm.
///
/// # Locking Script Layout (~10 KB)
///
/// \`\`\`text
/// Unlocking: <wotsSig(2144B)> <wotsPubKey(64B)> <ecdsaSig(~72B)> <ecdsaPubKey(33B)>
///
/// Locking:
///   // --- ECDSA verification (P2PKH) ---
///   OP_OVER OP_TOALTSTACK           // copy ecdsaSig to alt stack for WOTS later
///   OP_DUP OP_HASH160 <ecdsaPubKeyHash(20B)> OP_EQUALVERIFY OP_CHECKSIG OP_VERIFY
///   // --- WOTS+ pubkey commitment ---
///   OP_DUP OP_HASH160 <wotsPubKeyHash(20B)> OP_EQUALVERIFY
///   // --- WOTS+ verification ---
///   OP_FROMALTSTACK OP_ROT OP_ROT   // bring ecdsaSig back as WOTS message
///   <verifyWOTS ~10KB inline>        // verify WOTS+(ecdsaSig, wotsSig, wotsPubKey)
/// \`\`\`
///
/// # Stack Trace
///
/// | Step | Stack (top -> bottom) |
/// |------|----------------------|
/// | Start | wotsSig, wotsPK, ecdsaSig, ecdsaPK |
/// | After ECDSA verify | wotsSig, wotsPK |
/// | After WOTS PK hash check | wotsSig, wotsPK |
/// | After WOTS verify | (empty / true) |
///
/// # Parameter Sizes
///
/// - ecdsaPubKeyHash: 20 bytes (HASH160 of compressed ECDSA public key)
/// - wotsPubKeyHash: 20 bytes (HASH160 of 64-byte WOTS+ public key: pubSeed[32] || pkRoot[32])
/// - ecdsaSig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
/// - ecdsaPubKey: 33 bytes (compressed secp256k1 public key)
/// - wotsSig: 2,144 bytes (67 chains x 32 bytes)
/// - wotsPubKey: 64 bytes (pubSeed[32] || pkRoot[32])
#[runar::contract]
pub struct PostQuantumWallet {
    #[readonly]
    pub ecdsa_pub_key_hash: Addr,
    #[readonly]
    pub wots_pub_key_hash: ByteString,
}

#[runar::methods(PostQuantumWallet)]
impl PostQuantumWallet {
    /// Verify both ECDSA and WOTS+ signatures to allow spending.
    #[public]
    pub fn spend(&self, wots_sig: &ByteString, wots_pub_key: &ByteString, sig: &Sig, pub_key: &PubKey) {
        // Step 1: Verify ECDSA — proves sig commits to this transaction
        assert!(hash160(pub_key) == self.ecdsa_pub_key_hash);
        assert!(check_sig(sig, pub_key));

        // Step 2: Verify WOTS+ — proves ECDSA sig was authorized by WOTS key holder
        assert!(hash160(wots_pub_key) == self.wots_pub_key_hash);
        assert!(verify_wots(sig, wots_sig, wots_pub_key));
    }
}
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      wotsPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + WOTS+ post-quantum wallet. Quantum-resistant spending path.',
  },
  {
    id: 'python-post-quantum-wallet',
    name: 'Post-Quantum Wallet (WOTS+) (Python)',
    language: 'python',
    source: `"""Hybrid ECDSA + WOTS+ Post-Quantum Wallet.

Security Model: Two-Layer Authentication
=========================================

This contract creates a quantum-resistant spending path by combining
classical ECDSA with WOTS+ (Winternitz One-Time Signature):

 1. ECDSA proves the signature commits to this specific transaction
    (via OP_CHECKSIG over the sighash preimage).
 2. WOTS+ proves the ECDSA signature was authorized by the WOTS key
    holder -- the ECDSA signature bytes ARE the message that WOTS signs.

A quantum attacker who can break ECDSA could forge a valid ECDSA
signature, but they cannot produce a valid WOTS+ signature over their
forged sig without knowing the WOTS secret key. WOTS+ security relies
only on SHA-256 collision resistance, not on any number-theoretic
assumption vulnerable to Shor's algorithm.

Locking Script Layout (~10 KB)
==============================

Unlocking: <wotsSig(2144B)> <wotsPubKey(64B)> <ecdsaSig(~72B)> <ecdsaPubKey(33B)>

Locking:
  // --- ECDSA verification (P2PKH) ---
  OP_OVER OP_TOALTSTACK           // copy ecdsaSig to alt stack for WOTS later
  OP_DUP OP_HASH160 <ecdsaPubKeyHash(20B)> OP_EQUALVERIFY OP_CHECKSIG OP_VERIFY
  // --- WOTS+ pubkey commitment ---
  OP_DUP OP_HASH160 <wotsPubKeyHash(20B)> OP_EQUALVERIFY
  // --- WOTS+ verification ---
  OP_FROMALTSTACK OP_ROT OP_ROT   // bring ecdsaSig back as WOTS message
  <verifyWOTS ~10KB inline>        // verify WOTS+(ecdsaSig, wotsSig, wotsPubKey)

Stack Trace
===========

| Step                       | Stack (top -> bottom)                |
|----------------------------|--------------------------------------|
| Start                      | wotsSig, wotsPK, ecdsaSig, ecdsaPK  |
| After ECDSA verify         | wotsSig, wotsPK                      |
| After WOTS PK hash check   | wotsSig, wotsPK                      |
| After WOTS verify          | (empty / true)                       |

Parameter Sizes
===============

- ecdsaPubKeyHash: 20 bytes (HASH160 of compressed ECDSA public key)
- wotsPubKeyHash: 20 bytes (HASH160 of 64-byte WOTS+ public key: pubSeed[32] || pkRoot[32])
- ecdsaSig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
- ecdsaPubKey: 33 bytes (compressed secp256k1 public key)
- wotsSig: 2,144 bytes (67 chains x 32 bytes)
- wotsPubKey: 64 bytes (pubSeed[32] || pkRoot[32])
"""
from runar import SmartContract, ByteString, Addr, Sig, PubKey, public, assert_, hash160, check_sig, verify_wots

class PostQuantumWallet(SmartContract):
    ecdsa_pub_key_hash: Addr
    wots_pub_key_hash: ByteString

    def __init__(self, ecdsa_pub_key_hash: Addr, wots_pub_key_hash: ByteString):
        super().__init__(ecdsa_pub_key_hash, wots_pub_key_hash)
        self.ecdsa_pub_key_hash = ecdsa_pub_key_hash
        self.wots_pub_key_hash = wots_pub_key_hash

    @public
    def spend(self, wots_sig: ByteString, wots_pub_key: ByteString, sig: Sig, pub_key: PubKey):
        # Step 1: Verify ECDSA -- proves sig commits to this transaction
        assert_(hash160(pub_key) == self.ecdsa_pub_key_hash)
        assert_(check_sig(sig, pub_key))

        # Step 2: Verify WOTS+ -- proves ECDSA sig was authorized by WOTS key holder
        assert_(hash160(wots_pub_key) == self.wots_pub_key_hash)
        assert_(verify_wots(sig, wots_sig, wots_pub_key))
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      wotsPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + WOTS+ post-quantum wallet. Quantum-resistant spending path.',
  },
  {
    id: 'zig-post-quantum-wallet',
    name: 'Post-Quantum Wallet (WOTS+) (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const PostQuantumWallet = struct {
    pub const Contract = runar.SmartContract;

    ecdsaPubKeyHash: runar.Addr,
    wotsPubKeyHash: runar.ByteString,

    pub fn init(ecdsaPubKeyHash: runar.Addr, wotsPubKeyHash: runar.ByteString) PostQuantumWallet {
        return .{
            .ecdsaPubKeyHash = ecdsaPubKeyHash,
            .wotsPubKeyHash = wotsPubKeyHash,
        };
    }

    pub fn spend(
        self: *const PostQuantumWallet,
        wotsSig: runar.ByteString,
        wotsPubKey: runar.ByteString,
        sig: runar.Sig,
        pubKey: runar.PubKey,
    ) void {
        runar.assert(runar.bytesEq(runar.hash160(pubKey), self.ecdsaPubKeyHash));
        runar.assert(runar.checkSig(sig, pubKey));
        runar.assert(runar.bytesEq(runar.hash160(wotsPubKey), self.wotsPubKeyHash));
        runar.assert(runar.verifyWOTS(sig, wotsSig, wotsPubKey));
    }
};
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      wotsPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + WOTS+ post-quantum wallet. Quantum-resistant spending path.',
  },
  {
    id: 'ruby-post-quantum-wallet',
    name: 'Post-Quantum Wallet (WOTS+) (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class PostQuantumWallet < Runar::SmartContract
  prop :pubkey, ByteString

  def initialize(pubkey)
    super(pubkey)
    @pubkey = pubkey
  end

  runar_public msg: ByteString, sig: ByteString
  def spend(msg, sig)
    assert verify_wots(msg, sig, @pubkey)
  end
end
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      wotsPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + WOTS+ post-quantum wallet. Quantum-resistant spending path.',
  },
  {
    id: 'schnorr-zkp',
    name: 'Schnorr ZKP',
    language: 'typescript',
    source: `import {
  SmartContract, assert,
  ecAdd, ecMul, ecMulGen, ecPointX, ecPointY, ecOnCurve, ecModReduce,
  EC_N, hash256, cat, bin2num,
} from 'runar-lang';
import type { Point } from 'runar-lang';

/**
 * Schnorr Zero-Knowledge Proof verifier (non-interactive, Fiat-Shamir).
 *
 * Proves knowledge of a private key \`k\` such that \`P = k*G\` without
 * revealing \`k\`. Uses the Schnorr identification protocol with the
 * Fiat-Shamir heuristic to derive the challenge on-chain:
 *
 *   Prover: picks random r, computes R = r*G
 *   Challenge: e = bin2num(hash256(R || P))  (derived on-chain)
 *   Prover: sends s = r + e*k (mod n)
 *   Verifier: checks s*G === R + e*P
 *
 * The challenge is derived deterministically from the commitment and
 * public key, preventing the prover from choosing a convenient e.
 */
class SchnorrZKP extends SmartContract {
  readonly pubKey: Point;

  constructor(pubKey: Point) {
    super(pubKey);
    this.pubKey = pubKey;
  }

  /**
   * Verify a Schnorr ZKP proof.
   *
   * @param rPoint - The commitment R = r*G (prover's nonce point)
   * @param s      - The response s = r + e*k (mod n)
   */
  public verify(rPoint: Point, s: bigint) {
    // Verify R is on the curve
    assert(ecOnCurve(rPoint));

    // Derive challenge via Fiat-Shamir: e = bin2num(hash256(R || P))
    const e = bin2num(hash256(cat(rPoint, this.pubKey)));

    // Left side: s*G
    const sG = ecMulGen(s);

    // Right side: R + e*P
    const eP = ecMul(this.pubKey, e);
    const rhs = ecAdd(rPoint, eP);

    // Verify equality
    assert(ecPointX(sG) === ecPointX(rhs));
    assert(ecPointY(sG) === ecPointY(rhs));
  }
}
`,
    constructorArgs: {
      pubKey: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'Schnorr zero-knowledge proof verifier using Fiat-Shamir heuristic on secp256k1.',
  },
  {
    id: 'go-schnorr-zkp',
    name: 'Schnorr ZKP (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// SchnorrZKP verifies a Schnorr zero-knowledge proof (non-interactive, Fiat-Shamir).
//
// Proves knowledge of a private key k such that P = k*G without revealing k.
// Uses the Schnorr identification protocol with the Fiat-Shamir heuristic
// to derive the challenge on-chain:
//
//	Prover: picks random r, computes R = r*G
//	Challenge: e = Bin2Num(Hash256(R || P))  (derived on-chain)
//	Prover: sends s = r + e*k (mod n)
//	Verifier: checks s*G === R + e*P
//
// The challenge is derived deterministically from the commitment and
// public key, preventing the prover from choosing a convenient e.
type SchnorrZKP struct {
	runar.SmartContract
	// PubKey is the verifier's public key P = k*G (64-byte uncompressed Point).
	PubKey runar.Point \`runar:"readonly"\`
}

// Verify checks a Schnorr ZKP proof.
//
// rPoint is the commitment R = r*G (prover's nonce point).
// s is the response s = r + e*k (mod n).
func (c *SchnorrZKP) Verify(rPoint runar.Point, s runar.Bigint) {
	// Verify R is on the curve
	runar.Assert(runar.EcOnCurve(rPoint))

	// Derive challenge via Fiat-Shamir: e = Bin2Num(Hash256(R || P))
	e := runar.Bin2Num(runar.Hash256(runar.Cat(rPoint, c.PubKey)))

	// Left side: s*G
	sG := runar.EcMulGen(s)

	// Right side: R + e*P
	eP := runar.EcMul(c.PubKey, e)
	rhs := runar.EcAdd(rPoint, eP)

	// Verify equality
	runar.Assert(runar.EcPointX(sG) == runar.EcPointX(rhs))
	runar.Assert(runar.EcPointY(sG) == runar.EcPointY(rhs))
}
`,
    constructorArgs: {
      pubKey: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'Schnorr zero-knowledge proof verifier using Fiat-Shamir heuristic on secp256k1.',
  },
  {
    id: 'rust-schnorr-zkp',
    name: 'Schnorr ZKP (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// Schnorr zero-knowledge proof verifier (non-interactive, Fiat-Shamir).
///
/// Proves knowledge of a private key \`k\` such that \`P = k*G\` without
/// revealing \`k\`. Uses the Schnorr identification protocol with the
/// Fiat-Shamir heuristic to derive the challenge on-chain:
///
/// \`\`\`text
/// Prover: picks random r, computes R = r*G
/// Challenge: e = bin2num(hash256(R || P))  (derived on-chain)
/// Prover: sends s = r + e*k (mod n)
/// Verifier: checks s*G === R + e*P
/// \`\`\`
///
/// The challenge is derived deterministically from the commitment and
/// public key, preventing the prover from choosing a convenient e.
#[runar::contract]
pub struct SchnorrZKP {
    #[readonly]
    pub pub_key: Point,
}

#[runar::methods(SchnorrZKP)]
impl SchnorrZKP {
    /// Verify a Schnorr ZKP proof.
    ///
    /// - \`r_point\` - The commitment R = r*G (prover's nonce point)
    /// - \`s\` - The response s = r + e*k (mod n)
    #[public]
    pub fn verify(&self, r_point: &Point, s: Bigint) {
        // Verify R is on the curve
        assert!(ec_on_curve(r_point));

        // Derive challenge via Fiat-Shamir: e = bin2num(hash256(R || P))
        let e = bin2num(&hash256(&cat(r_point, &self.pub_key)));

        // Left side: s*G
        let s_g = ec_mul_gen(s);

        // Right side: R + e*P
        let e_p = ec_mul(&self.pub_key, e);
        let rhs = ec_add(r_point, &e_p);

        // Verify equality
        assert!(ec_point_x(&s_g) == ec_point_x(&rhs));
        assert!(ec_point_y(&s_g) == ec_point_y(&rhs));
    }
}
`,
    constructorArgs: {
      pubKey: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'Schnorr zero-knowledge proof verifier using Fiat-Shamir heuristic on secp256k1.',
  },
  {
    id: 'python-schnorr-zkp',
    name: 'Schnorr ZKP (Python)',
    language: 'python',
    source: `"""Schnorr Zero-Knowledge Proof verifier (non-interactive, Fiat-Shamir).

Proves knowledge of a private key k such that P = k*G without
revealing k. Uses the Schnorr identification protocol with the
Fiat-Shamir heuristic to derive the challenge on-chain:

    Prover: picks random r, computes R = r*G
    Challenge: e = bin2num(hash256(R || P))  (derived on-chain)
    Prover: sends s = r + e*k (mod n)
    Verifier: checks s*G === R + e*P

The challenge is derived deterministically from the commitment and
public key, preventing the prover from choosing a convenient e.
"""
from runar import (
    SmartContract, Point, Bigint, public, assert_,
    ec_add, ec_mul, ec_mul_gen, ec_point_x, ec_point_y, ec_on_curve,
    hash256, cat, bin2num,
)

class SchnorrZKP(SmartContract):
    """Verifies Schnorr ZKP proofs on-chain."""

    pub_key: Point

    def __init__(self, pub_key: Point):
        super().__init__(pub_key)
        self.pub_key = pub_key

    @public
    def verify(self, r_point: Point, s: Bigint):
        """Verify a Schnorr ZKP proof.

        Args:
            r_point: The commitment R = r*G (prover's nonce point).
            s: The response s = r + e*k (mod n).
        """
        # Verify R is on the curve
        assert_(ec_on_curve(r_point))

        # Derive challenge via Fiat-Shamir: e = bin2num(hash256(R || P))
        e = bin2num(hash256(cat(r_point, self.pub_key)))

        # Left side: s*G
        s_g = ec_mul_gen(s)

        # Right side: R + e*P
        e_p = ec_mul(self.pub_key, e)
        rhs = ec_add(r_point, e_p)

        # Verify equality
        assert_(ec_point_x(s_g) == ec_point_x(rhs))
        assert_(ec_point_y(s_g) == ec_point_y(rhs))
`,
    constructorArgs: {
      pubKey: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'Schnorr zero-knowledge proof verifier using Fiat-Shamir heuristic on secp256k1.',
  },
  {
    id: 'zig-schnorr-zkp',
    name: 'Schnorr ZKP (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const SchnorrZKP = struct {
    pub const Contract = runar.SmartContract;

    pubKey: runar.Point,

    pub fn init(pubKey: runar.Point) SchnorrZKP {
        return .{ .pubKey = pubKey };
    }

    pub fn verify(self: *const SchnorrZKP, rPoint: runar.Point, s: runar.Bigint) void {
        runar.assert(runar.ecOnCurve(rPoint));

        const e = runar.bin2num(runar.hash256(runar.cat(rPoint, self.pubKey)));
        const sG = runar.ecMulGen(s);
        const eP = runar.ecMul(self.pubKey, e);
        const rhs = runar.ecAdd(rPoint, eP);

        runar.assert(runar.bytesEq(runar.ecEncodeCompressed(sG), runar.ecEncodeCompressed(rhs)));
    }
};
`,
    constructorArgs: {
      pubKey: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'Schnorr zero-knowledge proof verifier using Fiat-Shamir heuristic on secp256k1.',
  },
  {
    id: 'ruby-schnorr-zkp',
    name: 'Schnorr ZKP (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class SchnorrZKP < Runar::SmartContract
  prop :pub_key, Point

  def initialize(pub_key)
    super(pub_key)
    @pub_key = pub_key
  end

  runar_public r_point: Point, s: Bigint
  def verify(r_point, s)
    assert ec_on_curve(r_point)
    e = bin2num(hash256(cat(r_point, @pub_key)))
    s_g = ec_mul_gen(s)
    e_p = ec_mul(@pub_key, e)
    rhs = ec_add(r_point, e_p)
    assert ec_point_x(s_g) == ec_point_x(rhs)
    assert ec_point_y(s_g) == ec_point_y(rhs)
  end
end
`,
    constructorArgs: {
      pubKey: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'Schnorr zero-knowledge proof verifier using Fiat-Shamir heuristic on secp256k1.',
  },
  {
    id: 'sha256-compress',
    name: 'SHA-256 Compress',
    language: 'typescript',
    source: `import { SmartContract, assert, sha256Compress } from 'runar-lang';
import type { ByteString } from 'runar-lang';

/**
 * Sha256CompressTest — verifies SHA-256 compression correctness on-chain.
 *
 * The sha256Compress intrinsic performs one round of SHA-256 block compression
 * (FIPS 180-4 Section 6.2.2): takes a 32-byte state and a 64-byte block,
 * producing a new 32-byte state. The compiled script is ~74KB (64 rounds of
 * bit manipulation using OP_LSHIFT, OP_RSHIFT, OP_AND, OP_XOR).
 *
 * For a single-block message (<=55 bytes), the caller pads per FIPS 180-4
 * Section 5.1.1 (append 0x80, zero-pad to 56 bytes, append 8-byte big-endian
 * bit length) and passes SHA-256 IV as the initial state. The result matches
 * the OP_SHA256 opcode.
 *
 * For multi-block messages, chain multiple sha256Compress calls — each
 * producing an intermediate state for the next block.
 */
class Sha256CompressTest extends SmartContract {
  readonly expected: ByteString;

  constructor(expected: ByteString) {
    super(expected);
    this.expected = expected;
  }

  public verify(state: ByteString, block: ByteString) {
    const result = sha256Compress(state, block);
    assert(result === this.expected);
  }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
      ],
    },
    description: 'Verifies a single SHA-256 compression function round (FIPS 180-4) on-chain.',
  },
  {
    id: 'sol-sha256-compress',
    name: 'SHA-256 Compress (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// Sha256CompressTest — verifies SHA-256 compression correctness on-chain.
///
/// sha256Compress performs one round of SHA-256 block compression (FIPS 180-4
/// Section 6.2.2). Takes a 32-byte state and 64-byte block, returns 32-byte state.
contract Sha256CompressTest is SmartContract {
    ByteString immutable expected;

    constructor(ByteString _expected) {
        expected = _expected;
    }

    function verify(ByteString state, ByteString block) public {
        ByteString result = sha256Compress(state, block);
        require(result == this.expected);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
      ],
    },
    description: 'Verifies a single SHA-256 compression function round (FIPS 180-4) on-chain.',
  },
  {
    id: 'move-sha256-compress',
    name: 'SHA-256 Compress (Move)',
    language: 'move',
    source: `module Sha256CompressTest {
    use runar::types::{ByteString};
    use runar::crypto::{sha256Compress};

    /// Sha256CompressTest — verifies SHA-256 compression correctness on-chain.
    ///
    /// sha256Compress performs one round of SHA-256 block compression (FIPS 180-4
    /// Section 6.2.2). Takes a 32-byte state and 64-byte block, returns 32-byte state.
    struct Sha256CompressTest {
        expected: ByteString,
    }

    public fun verify(contract: &Sha256CompressTest, state: ByteString, block: ByteString) {
        let result: ByteString = sha256Compress(state, block);
        assert!(result == contract.expected, 0);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
      ],
    },
    description: 'Verifies a single SHA-256 compression function round (FIPS 180-4) on-chain.',
  },
  {
    id: 'go-sha256-compress',
    name: 'SHA-256 Compress (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// Sha256CompressTest is a stateless contract that verifies a single SHA-256
// compression function invocation (FIPS 180-4 Section 6.2.2).
//
// The spender provides a 32-byte state and a 64-byte block. The contract
// computes Sha256Compress(state, block) and asserts the result matches
// the Expected digest baked into the locking script at deployment time.
type Sha256CompressTest struct {
	runar.SmartContract
	// Expected is the expected 32-byte SHA-256 compression output.
	Expected runar.ByteString \`runar:"readonly"\`
}

// Verify computes a single SHA-256 compression round and asserts the result
// matches the stored Expected value.
func (c *Sha256CompressTest) Verify(state runar.ByteString, block runar.ByteString) {
	result := runar.Sha256Compress(state, block)
	runar.Assert(result == c.Expected)
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
      ],
    },
    description: 'Verifies a single SHA-256 compression function round (FIPS 180-4) on-chain.',
  },
  {
    id: 'rust-sha256-compress',
    name: 'SHA-256 Compress (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// Sha256CompressTest -- verifies SHA-256 compression correctness on-chain.
///
/// The sha256_compress intrinsic performs one round of SHA-256 block compression
/// (FIPS 180-4 Section 6.2.2): takes a 32-byte state and a 64-byte block,
/// producing a new 32-byte state. The compiled script is ~74KB (64 rounds of
/// bit manipulation using OP_LSHIFT, OP_RSHIFT, OP_AND, OP_XOR).
///
/// For a single-block message (<=55 bytes), the caller pads per FIPS 180-4
/// Section 5.1.1 (append 0x80, zero-pad to 56 bytes, append 8-byte big-endian
/// bit length) and passes SHA-256 IV as the initial state. The result matches
/// the OP_SHA256 opcode.
///
/// For multi-block messages, chain multiple sha256_compress calls -- each
/// producing an intermediate state for the next block.
#[runar::contract]
pub struct Sha256CompressTest {
    #[readonly]
    pub expected: ByteString,
}

#[runar::methods(Sha256CompressTest)]
impl Sha256CompressTest {
    #[public]
    pub fn verify(&self, state: &ByteString, block: &ByteString) {
        let result = sha256_compress(state, block);
        assert!(result == self.expected);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
      ],
    },
    description: 'Verifies a single SHA-256 compression function round (FIPS 180-4) on-chain.',
  },
  {
    id: 'python-sha256-compress',
    name: 'SHA-256 Compress (Python)',
    language: 'python',
    source: `"""Sha256CompressTest -- verifies SHA-256 compression correctness on-chain.

The sha256_compress intrinsic performs one round of SHA-256 block compression
(FIPS 180-4 Section 6.2.2): takes a 32-byte state and a 64-byte block,
producing a new 32-byte state. The compiled script is ~74KB (64 rounds of
bit manipulation using OP_LSHIFT, OP_RSHIFT, OP_AND, OP_XOR).

For a single-block message (<=55 bytes), the caller pads per FIPS 180-4
Section 5.1.1 (append 0x80, zero-pad to 56 bytes, append 8-byte big-endian
bit length) and passes SHA-256 IV as the initial state. The result matches
the OP_SHA256 opcode.

For multi-block messages, chain multiple sha256_compress calls -- each
producing an intermediate state for the next block.
"""

from runar import SmartContract, ByteString, public, assert_, sha256_compress


class Sha256CompressTest(SmartContract):
    """Verifies SHA-256 compression output matches expected digest."""

    expected: ByteString

    def __init__(self, expected: ByteString):
        super().__init__(expected)
        self.expected = expected

    @public
    def verify(self, state: ByteString, block: ByteString):
        """Verify sha256_compress(state, block) matches expected."""
        result = sha256_compress(state, block)
        assert_(result == self.expected)
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
      ],
    },
    description: 'Verifies a single SHA-256 compression function round (FIPS 180-4) on-chain.',
  },
  {
    id: 'zig-sha256-compress',
    name: 'SHA-256 Compress (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const Sha256CompressTest = struct {
    pub const Contract = runar.SmartContract;

    expected: runar.ByteString,

    pub fn init(expected: runar.ByteString) Sha256CompressTest {
        return .{ .expected = expected };
    }

    pub fn verify(self: *const Sha256CompressTest, state: runar.ByteString, block: runar.ByteString) void {
        runar.assert(runar.bytesEq(runar.sha256Compress(state, block), self.expected));
    }
};
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
      ],
    },
    description: 'Verifies a single SHA-256 compression function round (FIPS 180-4) on-chain.',
  },
  {
    id: 'ruby-sha256-compress',
    name: 'SHA-256 Compress (Ruby)',
    language: 'ruby',
    source: `require 'runar'

# Sha256Compress -- A stateless contract demonstrating the built-in SHA-256
# compression primitive available in Runar.
#
# What is SHA-256 compression?
#
# SHA-256 (FIPS 180-4) processes messages in 512-bit (64-byte) blocks. The
# core operation is the compression function, which takes:
#   - A 32-byte state (8 x 32-bit big-endian words)
#   - A 64-byte message block (16 x 32-bit big-endian words)
#
# It expands the block into a 64-word message schedule, then runs 64 rounds
# using the SHA-256 round constants (K), Sigma, Ch, and Maj functions. The
# working variables are added back to the input state to produce the new state.
#
# For a single-block message (<=55 bytes of content after padding), the
# standard SHA-256 hash is produced by:
#   1. Appending 0x80 to the message
#   2. Zero-padding to 56 bytes
#   3. Appending the 8-byte big-endian bit length
#   4. Passing the SHA-256 IV as state and the 64-byte padded block to
#      sha256_compress
#
# The SHA-256 IV (big-endian hex):
#   6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19
#
# For multi-block messages, chain multiple sha256_compress calls: each call
# produces an intermediate state for the next block. Use sha256_finalize for
# the final (possibly partial) block to apply padding automatically.
#
# The compiled Bitcoin Script for sha256_compress is approximately 74 KB
# (64 rounds of bit manipulation using OP_LSHIFT, OP_RSHIFT, OP_AND, OP_XOR).
#
# Use cases:
#   - On-chain proof that some data hashes to a known SHA-256 digest
#   - Incremental hashing: split a large message across multiple transactions
#   - Hash-locked payments: lock funds to a SHA-256 preimage
#   - Commitment schemes: commit to a value with SHA-256, reveal later

class Sha256Compress < Runar::SmartContract
  # The expected 32-byte SHA-256 state output. Set at deployment time as part
  # of the locking script. The spending method computes sha256_compress from
  # the unlocking arguments and asserts the result matches this value.
  prop :expected, ByteString

  def initialize(expected)
    super(expected)
    @expected = expected
  end

  # Verify a SHA-256 compression function invocation.
  #
  # Computes sha256_compress(state, block) and asserts the 32-byte result
  # matches @expected. The caller provides both the 32-byte initial state and
  # the full 64-byte message block.
  #
  # To verify a standard SHA-256 hash of a short message (<=55 bytes):
  #   - state  = SHA-256 IV (32 bytes)
  #   - block  = message padded per FIPS 180-4 Section 5.1.1 to 64 bytes
  #   - expected = the SHA-256 digest you want to verify against
  runar_public state: ByteString, block: ByteString
  def verify(state, block)
    result = sha256_compress(state, block)
    assert result == @expected
  end
end
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' },
      ],
    },
    description: 'Verifies a single SHA-256 compression function round (FIPS 180-4) on-chain.',
  },
  {
    id: 'sha256-finalize',
    name: 'SHA-256 Finalize',
    language: 'typescript',
    source: `import { SmartContract, assert, sha256Finalize } from 'runar-lang';
import type { ByteString } from 'runar-lang';

/**
 * Sha256FinalizeTest — verifies SHA-256 finalize correctness on-chain.
 *
 * The sha256Finalize intrinsic handles FIPS 180-4 padding internally: it
 * appends the 0x80 byte, zero-pads, and appends the 8-byte big-endian bit
 * length, then compresses one or two blocks depending on the remaining length.
 *
 * - remaining <= 55 bytes: single-block path (one compression)
 * - 56-119 bytes: two-block path (two compressions)
 *
 * The msgBitLen parameter is the TOTAL message bit length (across all prior
 * compress calls), used in the final padding suffix.
 */
class Sha256FinalizeTest extends SmartContract {
  readonly expected: ByteString;

  constructor(expected: ByteString) {
    super(expected);
    this.expected = expected;
  }

  public verify(state: ByteString, remaining: ByteString, msgBitLen: bigint) {
    const result = sha256Finalize(state, remaining, msgBitLen);
    assert(result === this.expected);
  }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00' },
        { type: 'bigint', value: '8' },
      ],
    },
    description: 'Verifies SHA-256 finalization with FIPS 180-4 padding on-chain.',
  },
  {
    id: 'sol-sha256-finalize',
    name: 'SHA-256 Finalize (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// Sha256FinalizeTest — verifies SHA-256 finalize correctness on-chain.
///
/// sha256Finalize handles FIPS 180-4 padding internally and branches between
/// single-block (remaining <= 55 bytes) and two-block (56-119 bytes) paths.
contract Sha256FinalizeTest is SmartContract {
    ByteString immutable expected;

    constructor(ByteString _expected) {
        expected = _expected;
    }

    function verify(ByteString state, ByteString remaining, int msgBitLen) public {
        ByteString result = sha256Finalize(state, remaining, msgBitLen);
        require(result == this.expected);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00' },
        { type: 'bigint', value: '8' },
      ],
    },
    description: 'Verifies SHA-256 finalization with FIPS 180-4 padding on-chain.',
  },
  {
    id: 'move-sha256-finalize',
    name: 'SHA-256 Finalize (Move)',
    language: 'move',
    source: `module Sha256FinalizeTest {
    use runar::types::{ByteString};
    use runar::crypto::{sha256Finalize};

    /// Sha256FinalizeTest — verifies SHA-256 finalize correctness on-chain.
    ///
    /// sha256Finalize handles FIPS 180-4 padding internally and branches between
    /// single-block (remaining <= 55 bytes) and two-block (56-119 bytes) paths.
    struct Sha256FinalizeTest {
        expected: ByteString,
    }

    public fun verify(contract: &Sha256FinalizeTest, state: ByteString, remaining: ByteString, msg_bit_len: u64) {
        let result: ByteString = sha256Finalize(state, remaining, msg_bit_len);
        assert!(result == contract.expected, 0);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00' },
        { type: 'bigint', value: '8' },
      ],
    },
    description: 'Verifies SHA-256 finalization with FIPS 180-4 padding on-chain.',
  },
  {
    id: 'go-sha256-finalize',
    name: 'SHA-256 Finalize (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// Sha256FinalizeTest is a stateless contract that verifies SHA-256 finalization
// with FIPS 180-4 padding.
//
// The spender provides an intermediate state, the remaining unprocessed bytes,
// and the total message bit length. The contract computes
// Sha256Finalize(state, remaining, msgBitLen) and asserts the result matches
// the Expected digest baked into the locking script at deployment time.
type Sha256FinalizeTest struct {
	runar.SmartContract
	// Expected is the expected 32-byte SHA-256 digest after finalization.
	Expected runar.ByteString \`runar:"readonly"\`
}

// Verify applies FIPS 180-4 padding and the final compression round(s),
// then asserts the result matches the stored Expected value.
func (c *Sha256FinalizeTest) Verify(state runar.ByteString, remaining runar.ByteString, msgBitLen runar.Bigint) {
	result := runar.Sha256Finalize(state, remaining, msgBitLen)
	runar.Assert(result == c.Expected)
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00' },
        { type: 'bigint', value: '8' },
      ],
    },
    description: 'Verifies SHA-256 finalization with FIPS 180-4 padding on-chain.',
  },
  {
    id: 'rust-sha256-finalize',
    name: 'SHA-256 Finalize (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// Sha256FinalizeTest -- verifies SHA-256 finalize correctness on-chain.
///
/// The sha256_finalize intrinsic handles FIPS 180-4 padding internally: it
/// appends the 0x80 byte, zero-pads, and appends the 8-byte big-endian bit
/// length, then compresses one or two blocks depending on the remaining length.
///
/// - remaining <= 55 bytes: single-block path (one compression)
/// - 56-119 bytes: two-block path (two compressions)
///
/// The msg_bit_len parameter is the TOTAL message bit length (across all prior
/// compress calls), used in the final padding suffix.
#[runar::contract]
pub struct Sha256FinalizeTest {
    #[readonly]
    pub expected: ByteString,
}

#[runar::methods(Sha256FinalizeTest)]
impl Sha256FinalizeTest {
    #[public]
    pub fn verify(&self, state: &ByteString, remaining: &ByteString, msg_bit_len: Bigint) {
        let result = sha256_finalize(state, remaining, msg_bit_len);
        assert!(result == self.expected);
    }
}
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00' },
        { type: 'bigint', value: '8' },
      ],
    },
    description: 'Verifies SHA-256 finalization with FIPS 180-4 padding on-chain.',
  },
  {
    id: 'python-sha256-finalize',
    name: 'SHA-256 Finalize (Python)',
    language: 'python',
    source: `"""Sha256FinalizeTest -- verifies SHA-256 finalize correctness on-chain.

The sha256_finalize intrinsic handles FIPS 180-4 padding internally: it
appends the 0x80 byte, zero-pads, and appends the 8-byte big-endian bit
length, then compresses one or two blocks depending on the remaining length:

- remaining <= 55 bytes: single-block path (one compression, ~74KB script)
- 56-119 bytes: two-block path (two compressions, ~148KB script)

The msg_bit_len parameter is the TOTAL message bit length across all prior
sha256_compress calls plus the remaining bytes. This value is used in the
64-bit length suffix of the SHA-256 padding.

For standalone hashing, pass SHA-256 IV as state and the full message as
remaining. For multi-block hashing, use sha256_compress for the first N
full blocks and sha256_finalize for the trailing bytes.
"""

from runar import SmartContract, ByteString, Bigint, public, assert_, sha256_finalize


class Sha256FinalizeTest(SmartContract):
    """Verifies SHA-256 finalize output matches expected digest."""

    expected: ByteString

    def __init__(self, expected: ByteString):
        super().__init__(expected)
        self.expected = expected

    @public
    def verify(self, state: ByteString, remaining: ByteString, msg_bit_len: Bigint):
        """Verify sha256_finalize(state, remaining, msg_bit_len) matches expected."""
        result = sha256_finalize(state, remaining, msg_bit_len)
        assert_(result == self.expected)
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00' },
        { type: 'bigint', value: '8' },
      ],
    },
    description: 'Verifies SHA-256 finalization with FIPS 180-4 padding on-chain.',
  },
  {
    id: 'zig-sha256-finalize',
    name: 'SHA-256 Finalize (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const Sha256FinalizeTest = struct {
    pub const Contract = runar.SmartContract;

    expected: runar.ByteString,

    pub fn init(expected: runar.ByteString) Sha256FinalizeTest {
        return .{ .expected = expected };
    }

    pub fn verify(
        self: *const Sha256FinalizeTest,
        state: runar.ByteString,
        remaining: runar.ByteString,
        msgBitLen: i64,
    ) void {
        runar.assert(runar.bytesEq(runar.sha256Finalize(state, remaining, msgBitLen), self.expected));
    }
};
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00' },
        { type: 'bigint', value: '8' },
      ],
    },
    description: 'Verifies SHA-256 finalization with FIPS 180-4 padding on-chain.',
  },
  {
    id: 'ruby-sha256-finalize',
    name: 'SHA-256 Finalize (Ruby)',
    language: 'ruby',
    source: `require 'runar'

# Sha256Finalize -- A stateless contract demonstrating the built-in SHA-256
# finalization primitive available in Runar.
#
# What is SHA-256 finalization?
#
# sha256_finalize handles the final step of SHA-256 hashing: applying FIPS
# 180-4 padding to the remaining bytes and running one or two compression
# rounds depending on how much data remains.
#
# Padding scheme (FIPS 180-4 Section 5.1.1):
#   1. Append a 0x80 byte immediately after the message data
#   2. Zero-pad until 8 bytes short of a 64-byte block boundary
#   3. Append the 8-byte big-endian total message length in bits
#
# Two paths:
#   - Single-block path (remaining <= 55 bytes): the padding fits in one
#     64-byte block, so one compression round is performed (~74 KB script).
#   - Two-block path (56-119 bytes): padding spans two 64-byte blocks, so
#     two compression rounds are performed (~148 KB script).
#
# Parameters:
#   - state:       32-byte SHA-256 state (use SHA-256 IV for a single call,
#                  or pass the output of prior sha256_compress calls for
#                  multi-block hashing)
#   - remaining:   hex-encoded trailing message bytes not yet compressed
#                  (0-119 bytes)
#   - msg_bit_len: total message length in bits across ALL blocks including
#                  remaining (used in the 64-bit length suffix)
#
# For standalone SHA-256 of a short message (<= 55 bytes), pass:
#   - state  = SHA-256 IV
#   - remaining = the full message (hex-encoded)
#   - msg_bit_len = message byte count * 8
#
# The SHA-256 IV (big-endian hex):
#   6a09e667 bb67ae85 3c6ef372 a54ff53a 510e527f 9b05688c 1f83d9ab 5be0cd19
#
# For multi-block messages, process full 64-byte blocks with sha256_compress
# and pass the last partial block to sha256_finalize.
#
# Use cases:
#   - On-chain SHA-256 hash verification with automatic padding
#   - Final step in multi-block incremental SHA-256 hashing
#   - Hash-locked payments where the preimage is up to 55 bytes
#   - Commitment schemes with automatic padding

class Sha256Finalize < Runar::SmartContract
  # The expected 32-byte SHA-256 digest. Set at deployment time as part of
  # the locking script. The spending method computes sha256_finalize and
  # asserts the result matches this value.
  prop :expected, ByteString

  def initialize(expected)
    super(expected)
    @expected = expected
  end

  # Verify a SHA-256 finalization invocation.
  #
  # Computes sha256_finalize(state, remaining, msg_bit_len) and asserts the
  # 32-byte result matches @expected.
  #
  # To verify SHA-256(short_message) where short_message fits in one block:
  #   - state       = SHA-256 IV
  #   - remaining   = short_message (hex-encoded, 0-55 bytes)
  #   - msg_bit_len = short_message.bytesize * 8
  #   - expected    = SHA-256(short_message)
  runar_public state: ByteString, remaining: ByteString, msg_bit_len: Bigint
  def verify(state, remaining, msg_bit_len)
    result = sha256_finalize(state, remaining, msg_bit_len)
    assert result == @expected
  end
end
`,
    constructorArgs: {
      expected: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'verify',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00' },
        { type: 'bigint', value: '8' },
      ],
    },
    description: 'Verifies SHA-256 finalization with FIPS 180-4 padding on-chain.',
  },
  {
    id: 'sphincs-wallet',
    name: 'SPHINCS+ Wallet',
    language: 'typescript',
    source: `import { SmartContract, assert, hash160, checkSig, verifySLHDSA_SHA2_128s } from 'runar-lang';
import type { ByteString, Sig, PubKey, Addr } from 'runar-lang';

/**
 * Hybrid ECDSA + SLH-DSA-SHA2-128s (SPHINCS+) Post-Quantum Wallet.
 *
 * ## Security Model: Two-Layer Authentication
 *
 * This contract creates a quantum-resistant spending path by combining
 * classical ECDSA with SLH-DSA (FIPS 205, SPHINCS+):
 *
 * 1. **ECDSA** proves the signature commits to this specific transaction
 *    (via OP_CHECKSIG over the sighash preimage).
 * 2. **SLH-DSA** proves the ECDSA signature was authorized by the SLH-DSA
 *    key holder — the ECDSA signature bytes ARE the message that SLH-DSA signs.
 *
 * A quantum attacker who can break ECDSA could forge a valid ECDSA
 * signature, but they cannot produce a valid SLH-DSA signature over their
 * forged sig without knowing the SLH-DSA secret key. SLH-DSA security
 * relies only on SHA-256 collision resistance, not on any number-theoretic
 * assumption vulnerable to Shor's algorithm.
 *
 * Unlike WOTS+ (one-time), SLH-DSA is stateless and the same keypair
 * can sign many messages — it's NIST FIPS 205 standardized.
 *
 * ## Locking Script Layout (~200 KB)
 *
 * \`\`\`
 * Unlocking: <slhdsaSig(7856B)> <slhdsaPubKey(32B)> <ecdsaSig(~72B)> <ecdsaPubKey(33B)>
 *
 * Locking:
 *   // --- ECDSA verification (P2PKH) ---
 *   OP_OVER OP_TOALTSTACK           // copy ecdsaSig to alt stack for SLH-DSA later
 *   OP_DUP OP_HASH160 <ecdsaPubKeyHash(20B)> OP_EQUALVERIFY OP_CHECKSIG OP_VERIFY
 *   // --- SLH-DSA pubkey commitment ---
 *   OP_DUP OP_HASH160 <slhdsaPubKeyHash(20B)> OP_EQUALVERIFY
 *   // --- SLH-DSA verification ---
 *   OP_FROMALTSTACK OP_ROT OP_ROT
 *   <verifySLHDSA ~200KB inline>
 * \`\`\`
 *
 * ## Parameter Sizes
 *
 * - ecdsaPubKeyHash: 20 bytes (HASH160 of compressed ECDSA public key)
 * - slhdsaPubKeyHash: 20 bytes (HASH160 of 32-byte SLH-DSA public key)
 * - ecdsaSig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
 * - ecdsaPubKey: 33 bytes (compressed secp256k1 public key)
 * - slhdsaSig: 7,856 bytes (SLH-DSA-SHA2-128s signature)
 * - slhdsaPubKey: 32 bytes (PK.seed || PK.root)
 */
class SPHINCSWallet extends SmartContract {
  readonly ecdsaPubKeyHash: Addr;
  readonly slhdsaPubKeyHash: ByteString;

  constructor(ecdsaPubKeyHash: Addr, slhdsaPubKeyHash: ByteString) {
    super(ecdsaPubKeyHash, slhdsaPubKeyHash);
    this.ecdsaPubKeyHash = ecdsaPubKeyHash;
    this.slhdsaPubKeyHash = slhdsaPubKeyHash;
  }

  public spend(slhdsaSig: ByteString, slhdsaPubKey: ByteString, sig: Sig, pubKey: PubKey) {
    // Step 1: Verify ECDSA — proves sig commits to this transaction
    assert(hash160(pubKey) === this.ecdsaPubKeyHash);
    assert(checkSig(sig, pubKey));

    // Step 2: Verify SLH-DSA — proves ECDSA sig was authorized by SLH-DSA key holder
    assert(hash160(slhdsaPubKey) === this.slhdsaPubKeyHash);
    assert(verifySLHDSA_SHA2_128s(sig, slhdsaSig, slhdsaPubKey));
  }
}
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      slhdsaPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + SLH-DSA (SPHINCS+) post-quantum wallet. NIST FIPS 205 standardized.',
  },
  {
    id: 'go-sphincs-wallet',
    name: 'SPHINCS+ Wallet (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// SPHINCSWallet — Hybrid ECDSA + SLH-DSA-SHA2-128s (SPHINCS+) Post-Quantum Wallet.
//
// # Security Model: Two-Layer Authentication
//
// This contract creates a quantum-resistant spending path by combining
// classical ECDSA with SLH-DSA (FIPS 205, SPHINCS+):
//
//  1. ECDSA proves the signature commits to this specific transaction
//     (via OP_CHECKSIG over the sighash preimage).
//  2. SLH-DSA proves the ECDSA signature was authorized by the SLH-DSA
//     key holder — the ECDSA signature bytes ARE the message that SLH-DSA signs.
//
// A quantum attacker who can break ECDSA could forge a valid ECDSA
// signature, but they cannot produce a valid SLH-DSA signature over their
// forged sig without knowing the SLH-DSA secret key. SLH-DSA security
// relies only on SHA-256 collision resistance, not on any number-theoretic
// assumption vulnerable to Shor's algorithm.
//
// Unlike WOTS+ (one-time), SLH-DSA is stateless and the same keypair
// can sign many messages — it's NIST FIPS 205 standardized.
//
// # Locking Script Layout (~200 KB)
//
//	Unlocking: <slhdsaSig(7856B)> <slhdsaPubKey(32B)> <ecdsaSig(~72B)> <ecdsaPubKey(33B)>
//
//	Locking:
//	  // --- ECDSA verification (P2PKH) ---
//	  OP_OVER OP_TOALTSTACK
//	  OP_DUP OP_HASH160 <ecdsaPubKeyHash(20B)> OP_EQUALVERIFY OP_CHECKSIG OP_VERIFY
//	  // --- SLH-DSA pubkey commitment ---
//	  OP_DUP OP_HASH160 <slhdsaPubKeyHash(20B)> OP_EQUALVERIFY
//	  // --- SLH-DSA verification ---
//	  OP_FROMALTSTACK OP_ROT OP_ROT
//	  <verifySLHDSA ~200KB inline>
//
// # Parameter Sizes
//
//   - ecdsaPubKeyHash: 20 bytes (HASH160 of compressed ECDSA public key)
//   - slhdsaPubKeyHash: 20 bytes (HASH160 of 32-byte SLH-DSA public key)
//   - ecdsaSig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
//   - ecdsaPubKey: 33 bytes (compressed secp256k1 public key)
//   - slhdsaSig: 7,856 bytes (SLH-DSA-SHA2-128s signature)
//   - slhdsaPubKey: 32 bytes (PK.seed || PK.root)
type SPHINCSWallet struct {
	runar.SmartContract
	EcdsaPubKeyHash  runar.Addr       \`runar:"readonly"\`
	SlhdsaPubKeyHash runar.ByteString \`runar:"readonly"\`
}

// Spend verifies both ECDSA and SLH-DSA-SHA2-128s signatures to allow spending.
func (c *SPHINCSWallet) Spend(slhdsaSig runar.ByteString, slhdsaPubKey runar.ByteString, sig runar.Sig, pubKey runar.PubKey) {
	// Step 1: Verify ECDSA — proves sig commits to this transaction
	runar.Assert(runar.Hash160(pubKey) == c.EcdsaPubKeyHash)
	runar.Assert(runar.CheckSig(sig, pubKey))

	// Step 2: Verify SLH-DSA — proves ECDSA sig was authorized by SLH-DSA key holder
	runar.Assert(runar.Hash160(slhdsaPubKey) == c.SlhdsaPubKeyHash)
	runar.Assert(runar.VerifySLHDSA_SHA2_128s(sig, slhdsaSig, slhdsaPubKey))
}
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      slhdsaPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + SLH-DSA (SPHINCS+) post-quantum wallet. NIST FIPS 205 standardized.',
  },
  {
    id: 'rust-sphincs-wallet',
    name: 'SPHINCS+ Wallet (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// Hybrid ECDSA + SLH-DSA-SHA2-128s (SPHINCS+) Post-Quantum Wallet.
///
/// # Security Model: Two-Layer Authentication
///
/// This contract creates a quantum-resistant spending path by combining
/// classical ECDSA with SLH-DSA (FIPS 205, SPHINCS+):
///
///  1. **ECDSA** proves the signature commits to this specific transaction
///     (via OP_CHECKSIG over the sighash preimage).
///  2. **SLH-DSA** proves the ECDSA signature was authorized by the SLH-DSA
///     key holder — the ECDSA signature bytes ARE the message that SLH-DSA signs.
///
/// A quantum attacker who can break ECDSA could forge a valid ECDSA
/// signature, but they cannot produce a valid SLH-DSA signature over their
/// forged sig without knowing the SLH-DSA secret key. SLH-DSA security
/// relies only on SHA-256 collision resistance, not on any number-theoretic
/// assumption vulnerable to Shor's algorithm.
///
/// Unlike WOTS+ (one-time), SLH-DSA is stateless and the same keypair
/// can sign many messages — it's NIST FIPS 205 standardized.
///
/// # Locking Script Layout (~200 KB)
///
/// \`\`\`text
/// Unlocking: <slhdsaSig(7856B)> <slhdsaPubKey(32B)> <ecdsaSig(~72B)> <ecdsaPubKey(33B)>
///
/// Locking:
///   // --- ECDSA verification (P2PKH) ---
///   OP_OVER OP_TOALTSTACK
///   OP_DUP OP_HASH160 <ecdsaPubKeyHash(20B)> OP_EQUALVERIFY OP_CHECKSIG OP_VERIFY
///   // --- SLH-DSA pubkey commitment ---
///   OP_DUP OP_HASH160 <slhdsaPubKeyHash(20B)> OP_EQUALVERIFY
///   // --- SLH-DSA verification ---
///   OP_FROMALTSTACK OP_ROT OP_ROT
///   <verifySLHDSA ~200KB inline>
/// \`\`\`
///
/// # Parameter Sizes
///
/// - ecdsaPubKeyHash: 20 bytes (HASH160 of compressed ECDSA public key)
/// - slhdsaPubKeyHash: 20 bytes (HASH160 of 32-byte SLH-DSA public key)
/// - ecdsaSig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
/// - ecdsaPubKey: 33 bytes (compressed secp256k1 public key)
/// - slhdsaSig: 7,856 bytes (SLH-DSA-SHA2-128s signature)
/// - slhdsaPubKey: 32 bytes (PK.seed || PK.root)
#[runar::contract]
pub struct SPHINCSWallet {
    #[readonly]
    pub ecdsa_pub_key_hash: Addr,
    #[readonly]
    pub slhdsa_pub_key_hash: ByteString,
}

#[runar::methods(SPHINCSWallet)]
impl SPHINCSWallet {
    /// Verify both ECDSA and SLH-DSA-SHA2-128s signatures to allow spending.
    #[public]
    pub fn spend(&self, slhdsa_sig: &ByteString, slhdsa_pub_key: &ByteString, sig: &Sig, pub_key: &PubKey) {
        // Step 1: Verify ECDSA — proves sig commits to this transaction
        assert!(hash160(pub_key) == self.ecdsa_pub_key_hash);
        assert!(check_sig(sig, pub_key));

        // Step 2: Verify SLH-DSA — proves ECDSA sig was authorized by SLH-DSA key holder
        assert!(hash160(slhdsa_pub_key) == self.slhdsa_pub_key_hash);
        assert!(verify_slh_dsa_sha2_128s(sig, slhdsa_sig, slhdsa_pub_key));
    }
}
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      slhdsaPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + SLH-DSA (SPHINCS+) post-quantum wallet. NIST FIPS 205 standardized.',
  },
  {
    id: 'python-sphincs-wallet',
    name: 'SPHINCS+ Wallet (Python)',
    language: 'python',
    source: `"""Hybrid ECDSA + SLH-DSA-SHA2-128s (SPHINCS+) Post-Quantum Wallet.

Security Model: Two-Layer Authentication
=========================================

This contract creates a quantum-resistant spending path by combining
classical ECDSA with SLH-DSA (FIPS 205, SPHINCS+):

 1. ECDSA proves the signature commits to this specific transaction
    (via OP_CHECKSIG over the sighash preimage).
 2. SLH-DSA proves the ECDSA signature was authorized by the SLH-DSA
    key holder -- the ECDSA signature bytes ARE the message that SLH-DSA signs.

A quantum attacker who can break ECDSA could forge a valid ECDSA
signature, but they cannot produce a valid SLH-DSA signature over their
forged sig without knowing the SLH-DSA secret key. SLH-DSA security
relies only on SHA-256 collision resistance, not on any number-theoretic
assumption vulnerable to Shor's algorithm.

Unlike WOTS+ (one-time), SLH-DSA is stateless and the same keypair
can sign many messages -- it's NIST FIPS 205 standardized.

Locking Script Layout (~200 KB)
===============================

Unlocking: <slhdsaSig(7856B)> <slhdsaPubKey(32B)> <ecdsaSig(~72B)> <ecdsaPubKey(33B)>

Locking:
  // --- ECDSA verification (P2PKH) ---
  OP_OVER OP_TOALTSTACK
  OP_DUP OP_HASH160 <ecdsaPubKeyHash(20B)> OP_EQUALVERIFY OP_CHECKSIG OP_VERIFY
  // --- SLH-DSA pubkey commitment ---
  OP_DUP OP_HASH160 <slhdsaPubKeyHash(20B)> OP_EQUALVERIFY
  // --- SLH-DSA verification ---
  OP_FROMALTSTACK OP_ROT OP_ROT
  <verifySLHDSA ~200KB inline>

Parameter Sizes
===============

- ecdsaPubKeyHash: 20 bytes (HASH160 of compressed ECDSA public key)
- slhdsaPubKeyHash: 20 bytes (HASH160 of 32-byte SLH-DSA public key)
- ecdsaSig: ~72 bytes (DER-encoded ECDSA signature + sighash flag)
- ecdsaPubKey: 33 bytes (compressed secp256k1 public key)
- slhdsaSig: 7,856 bytes (SLH-DSA-SHA2-128s signature)
- slhdsaPubKey: 32 bytes (PK.seed || PK.root)
"""
from runar import SmartContract, ByteString, Addr, Sig, PubKey, public, assert_, hash160, check_sig, verify_slh_dsa_sha2_128s

class SPHINCSWallet(SmartContract):
    ecdsa_pub_key_hash: Addr
    slhdsa_pub_key_hash: ByteString

    def __init__(self, ecdsa_pub_key_hash: Addr, slhdsa_pub_key_hash: ByteString):
        super().__init__(ecdsa_pub_key_hash, slhdsa_pub_key_hash)
        self.ecdsa_pub_key_hash = ecdsa_pub_key_hash
        self.slhdsa_pub_key_hash = slhdsa_pub_key_hash

    @public
    def spend(self, slhdsa_sig: ByteString, slhdsa_pub_key: ByteString, sig: Sig, pub_key: PubKey):
        # Step 1: Verify ECDSA -- proves sig commits to this transaction
        assert_(hash160(pub_key) == self.ecdsa_pub_key_hash)
        assert_(check_sig(sig, pub_key))

        # Step 2: Verify SLH-DSA -- proves ECDSA sig was authorized by SLH-DSA key holder
        assert_(hash160(slhdsa_pub_key) == self.slhdsa_pub_key_hash)
        assert_(verify_slh_dsa_sha2_128s(sig, slhdsa_sig, slhdsa_pub_key))
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      slhdsaPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + SLH-DSA (SPHINCS+) post-quantum wallet. NIST FIPS 205 standardized.',
  },
  {
    id: 'zig-sphincs-wallet',
    name: 'SPHINCS+ Wallet (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const SPHINCSWallet = struct {
    pub const Contract = runar.SmartContract;

    ecdsaPubKeyHash: runar.Addr,
    slhdsaPubKeyHash: runar.ByteString,

    pub fn init(ecdsaPubKeyHash: runar.Addr, slhdsaPubKeyHash: runar.ByteString) SPHINCSWallet {
        return .{
            .ecdsaPubKeyHash = ecdsaPubKeyHash,
            .slhdsaPubKeyHash = slhdsaPubKeyHash,
        };
    }

    pub fn spend(
        self: *const SPHINCSWallet,
        slhdsaSig: runar.ByteString,
        slhdsaPubKey: runar.ByteString,
        sig: runar.Sig,
        pubKey: runar.PubKey,
    ) void {
        runar.assert(runar.bytesEq(runar.hash160(pubKey), self.ecdsaPubKeyHash));
        runar.assert(runar.checkSig(sig, pubKey));
        runar.assert(runar.bytesEq(runar.hash160(slhdsaPubKey), self.slhdsaPubKeyHash));
        runar.assert(runar.verifySLHDSA_SHA2_128s(sig, slhdsaSig, slhdsaPubKey));
    }
};
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      slhdsaPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + SLH-DSA (SPHINCS+) post-quantum wallet. NIST FIPS 205 standardized.',
  },
  {
    id: 'ruby-sphincs-wallet',
    name: 'SPHINCS+ Wallet (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class SPHINCSWallet < Runar::SmartContract
  prop :pubkey, ByteString

  def initialize(pubkey)
    super(pubkey)
    @pubkey = pubkey
  end

  runar_public msg: ByteString, sig: ByteString
  def spend(msg, sig)
    assert verify_slh_dsa_sha2_128s(msg, sig, @pubkey)
  end
end
`,
    constructorArgs: {
      ecdsaPubKeyHash: ALICE.pubKeyHash,
      slhdsaPubKeyHash: '0000000000000000000000000000000000000000',
    },
    methodCall: {
      method: 'spend',
      args: [
        { type: 'ByteString', value: '0000000000000000000000000000000000000000000000000000000000000000' },
        { type: 'ByteString', value: '00000000000000000000000000000000' },
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: ALICE.pubKey },
      ],
    },
    description: 'Hybrid ECDSA + SLH-DSA (SPHINCS+) post-quantum wallet. NIST FIPS 205 standardized.',
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic-Tac-Toe',
    language: 'typescript',
    source: `import { StatefulSmartContract, assert, checkSig, num2bin, cat, hash160, hash256, extractOutputHash } from 'runar-lang';
import type { PubKey, Sig, ByteString } from 'runar-lang';

/**
 * On-chain Tic-Tac-Toe contract.
 *
 * Two players compete on a 3x3 board. Each move is an on-chain transaction.
 * The contract holds both players' bets and enforces correct game rules
 * entirely in Bitcoin Script.
 *
 * **Board encoding:**
 * Since Runar has no arrays, the 3x3 board uses 9 individual bigint fields
 * (c0-c8). Values: 0=empty, 1=X, 2=O.
 *
 * **Lifecycle:**
 * 1. Player X deploys the contract with their bet amount.
 * 2. Player O calls {@link join} to enter the game, adding their bet.
 * 3. Players alternate calling {@link move} (non-terminal) or
 *    {@link moveAndWin} / {@link moveAndTie} (terminal).
 * 4. Either player can propose {@link cancel} (requires both signatures).
 *
 * **Method types:**
 * - State-mutating: \`join\`, \`move\` — produce a continuation UTXO.
 * - Non-mutating terminal: \`moveAndWin\`, \`moveAndTie\`, \`cancel\` — spend
 *   the UTXO and enforce payout outputs via extractOutputHash.
 *
 * **Signature pattern:**
 * Each method takes a \`sig\` and the signer's \`player\` pubkey. The contract
 * verifies the signature against the provided pubkey (single checkSig per
 * method, since Sig is affine/single-use), then asserts that pubkey matches
 * the expected player for the current turn.
 */
export class TicTacToe extends StatefulSmartContract {
  readonly playerX: PubKey;
  readonly betAmount: bigint;
  readonly p2pkhPrefix: ByteString = "1976a914" as ByteString;
  readonly p2pkhSuffix: ByteString = "88ac" as ByteString;

  playerO: PubKey = "000000000000000000000000000000000000000000000000000000000000000000" as PubKey;
  c0: bigint = 0n;
  c1: bigint = 0n;
  c2: bigint = 0n;
  c3: bigint = 0n;
  c4: bigint = 0n;
  c5: bigint = 0n;
  c6: bigint = 0n;
  c7: bigint = 0n;
  c8: bigint = 0n;
  turn: bigint = 0n;
  status: bigint = 0n;

  constructor(playerX: PubKey, betAmount: bigint) {
    super(playerX, betAmount);
    this.playerX = playerX;
    this.betAmount = betAmount;
  }

  /**
   * Player O joins the game.
   * State-mutating: produces continuation UTXO with doubled bet.
   */
  public join(opponentPK: PubKey, sig: Sig) {
    assert(this.status == 0n);
    assert(checkSig(sig, opponentPK));
    this.playerO = opponentPK;
    this.status = 1n;
    this.turn = 1n;
  }

  /**
   * Make a non-terminal move. Updates board and flips turn.
   * State-mutating: produces continuation UTXO.
   * Caller provides their pubkey; contract verifies it matches the expected turn.
   */
  public move(position: bigint, player: PubKey, sig: Sig) {
    assert(this.status == 1n);
    assert(checkSig(sig, player));
    this.assertCorrectPlayer(player);
    this.placeMove(position);
    if (this.turn == 1n) {
      this.turn = 2n;
    } else {
      this.turn = 1n;
    }
  }

  /**
   * Make a winning move. Non-mutating terminal method.
   * Enforces winner-gets-all payout via extractOutputHash.
   * Supports optional change output for fee funding.
   */
  public moveAndWin(position: bigint, player: PubKey, sig: Sig, changePKH: ByteString, changeAmount: bigint) {
    assert(this.status == 1n);
    assert(checkSig(sig, player));
    this.assertCorrectPlayer(player);
    this.assertCellEmpty(position);
    assert(this.checkWinAfterMove(position, this.turn));

    const totalPayout = this.betAmount * 2n;
    const payout = cat(cat(num2bin(totalPayout, 8n), this.p2pkhPrefix), cat(hash160(player), this.p2pkhSuffix));
    if (changeAmount > 0n) {
      const change = cat(cat(num2bin(changeAmount, 8n), this.p2pkhPrefix), cat(changePKH, this.p2pkhSuffix));
      assert(hash256(cat(payout, change)) == extractOutputHash(this.txPreimage));
    } else {
      assert(hash256(payout) == extractOutputHash(this.txPreimage));
    }
  }

  /**
   * Make a move that fills the board (tie). Non-mutating terminal method.
   * Enforces equal split payout via extractOutputHash.
   * Supports optional change output for fee funding.
   */
  public moveAndTie(position: bigint, player: PubKey, sig: Sig, changePKH: ByteString, changeAmount: bigint) {
    assert(this.status == 1n);
    assert(checkSig(sig, player));
    this.assertCorrectPlayer(player);
    this.assertCellEmpty(position);
    assert(this.countOccupied() == 8n);
    assert(!this.checkWinAfterMove(position, this.turn));

    const out1 = cat(cat(num2bin(this.betAmount, 8n), this.p2pkhPrefix), cat(hash160(this.playerX), this.p2pkhSuffix));
    const out2 = cat(cat(num2bin(this.betAmount, 8n), this.p2pkhPrefix), cat(hash160(this.playerO), this.p2pkhSuffix));
    if (changeAmount > 0n) {
      const change = cat(cat(num2bin(changeAmount, 8n), this.p2pkhPrefix), cat(changePKH, this.p2pkhSuffix));
      assert(hash256(cat(cat(out1, out2), change)) == extractOutputHash(this.txPreimage));
    } else {
      assert(hash256(cat(out1, out2)) == extractOutputHash(this.txPreimage));
    }
  }

  /**
   * Player X cancels before anyone joins. Non-mutating terminal method.
   * Refunds the full bet to player X.
   * Supports optional change output for fee funding.
   */
  public cancelBeforeJoin(sig: Sig, changePKH: ByteString, changeAmount: bigint) {
    assert(this.status == 0n);
    assert(checkSig(sig, this.playerX));
    const payout = cat(cat(num2bin(this.betAmount, 8n), this.p2pkhPrefix), cat(hash160(this.playerX), this.p2pkhSuffix));
    if (changeAmount > 0n) {
      const change = cat(cat(num2bin(changeAmount, 8n), this.p2pkhPrefix), cat(changePKH, this.p2pkhSuffix));
      assert(hash256(cat(payout, change)) == extractOutputHash(this.txPreimage));
    } else {
      assert(hash256(payout) == extractOutputHash(this.txPreimage));
    }
  }

  /**
   * Both players agree to cancel. Non-mutating terminal method.
   * Enforces equal refund via extractOutputHash.
   * Supports optional change output for fee funding.
   */
  public cancel(sigX: Sig, sigO: Sig, changePKH: ByteString, changeAmount: bigint) {
    const out1 = cat(cat(num2bin(this.betAmount, 8n), this.p2pkhPrefix), cat(hash160(this.playerX), this.p2pkhSuffix));
    const out2 = cat(cat(num2bin(this.betAmount, 8n), this.p2pkhPrefix), cat(hash160(this.playerO), this.p2pkhSuffix));
    if (changeAmount > 0n) {
      const change = cat(cat(num2bin(changeAmount, 8n), this.p2pkhPrefix), cat(changePKH, this.p2pkhSuffix));
      assert(hash256(cat(cat(out1, out2), change)) == extractOutputHash(this.txPreimage));
    } else {
      assert(hash256(cat(out1, out2)) == extractOutputHash(this.txPreimage));
    }
    assert(checkSig(sigX, this.playerX));
    assert(checkSig(sigO, this.playerO));
  }

  // --- Private helpers ---

  /** Assert the provided player pubkey matches whoever's turn it is. */
  private assertCorrectPlayer(player: PubKey) {
    if (this.turn == 1n) {
      assert(player == this.playerX);
    } else {
      assert(player == this.playerO);
    }
  }

  private assertCellEmpty(position: bigint) {
    if (position == 0n) { assert(this.c0 == 0n); }
    else if (position == 1n) { assert(this.c1 == 0n); }
    else if (position == 2n) { assert(this.c2 == 0n); }
    else if (position == 3n) { assert(this.c3 == 0n); }
    else if (position == 4n) { assert(this.c4 == 0n); }
    else if (position == 5n) { assert(this.c5 == 0n); }
    else if (position == 6n) { assert(this.c6 == 0n); }
    else if (position == 7n) { assert(this.c7 == 0n); }
    else if (position == 8n) { assert(this.c8 == 0n); }
    else { assert(false); }
  }

  private placeMove(position: bigint) {
    this.assertCellEmpty(position);
    if (position == 0n) { this.c0 = this.turn; }
    else if (position == 1n) { this.c1 = this.turn; }
    else if (position == 2n) { this.c2 = this.turn; }
    else if (position == 3n) { this.c3 = this.turn; }
    else if (position == 4n) { this.c4 = this.turn; }
    else if (position == 5n) { this.c5 = this.turn; }
    else if (position == 6n) { this.c6 = this.turn; }
    else if (position == 7n) { this.c7 = this.turn; }
    else if (position == 8n) { this.c8 = this.turn; }
    else { assert(false); }
  }

  private getCellOrOverride(cellIndex: bigint, overridePos: bigint, overrideVal: bigint): bigint {
    if (cellIndex == overridePos) {
      return overrideVal;
    }
    if (cellIndex == 0n) { return this.c0; }
    else if (cellIndex == 1n) { return this.c1; }
    else if (cellIndex == 2n) { return this.c2; }
    else if (cellIndex == 3n) { return this.c3; }
    else if (cellIndex == 4n) { return this.c4; }
    else if (cellIndex == 5n) { return this.c5; }
    else if (cellIndex == 6n) { return this.c6; }
    else if (cellIndex == 7n) { return this.c7; }
    else { return this.c8; }
  }

  private checkWinAfterMove(position: bigint, player: bigint): boolean {
    const v0 = this.getCellOrOverride(0n, position, player);
    const v1 = this.getCellOrOverride(1n, position, player);
    const v2 = this.getCellOrOverride(2n, position, player);
    const v3 = this.getCellOrOverride(3n, position, player);
    const v4 = this.getCellOrOverride(4n, position, player);
    const v5 = this.getCellOrOverride(5n, position, player);
    const v6 = this.getCellOrOverride(6n, position, player);
    const v7 = this.getCellOrOverride(7n, position, player);
    const v8 = this.getCellOrOverride(8n, position, player);

    if (v0 == player && v1 == player && v2 == player) { return true; }
    if (v3 == player && v4 == player && v5 == player) { return true; }
    if (v6 == player && v7 == player && v8 == player) { return true; }
    if (v0 == player && v3 == player && v6 == player) { return true; }
    if (v1 == player && v4 == player && v7 == player) { return true; }
    if (v2 == player && v5 == player && v8 == player) { return true; }
    if (v0 == player && v4 == player && v8 == player) { return true; }
    if (v2 == player && v4 == player && v6 == player) { return true; }
    return false;
  }

  private countOccupied(): bigint {
    let count = 0n;
    if (this.c0 != 0n) { count = count + 1n; }
    if (this.c1 != 0n) { count = count + 1n; }
    if (this.c2 != 0n) { count = count + 1n; }
    if (this.c3 != 0n) { count = count + 1n; }
    if (this.c4 != 0n) { count = count + 1n; }
    if (this.c5 != 0n) { count = count + 1n; }
    if (this.c6 != 0n) { count = count + 1n; }
    if (this.c7 != 0n) { count = count + 1n; }
    if (this.c8 != 0n) { count = count + 1n; }
    return count;
  }
}
`,
    constructorArgs: {
      playerX: ALICE.pubKey,
      betAmount: 10000n,
    },
    methodCall: {
      method: 'join',
      args: [
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: 'On-chain Tic-Tac-Toe game. Two players bet and compete, rules enforced by Bitcoin Script.',
  },
  {
    id: 'sol-tic-tac-toe',
    name: 'Tic-Tac-Toe (Solidity)',
    language: 'solidity',
    source: `pragma runar ^0.1.0;

/// @title TicTacToe
/// @notice On-chain Tic-Tac-Toe contract.
///
/// Two players compete on a 3x3 board. Each move is an on-chain transaction.
/// The contract holds both players' bets and enforces correct game rules
/// entirely in Bitcoin Script.
///
/// Board encoding:
/// Since Runar has no arrays, the 3x3 board uses 9 individual bigint fields
/// (c0-c8). Values: 0=empty, 1=X, 2=O.
///
/// Lifecycle:
/// 1. Player X deploys the contract with their bet amount.
/// 2. Player O calls join to enter the game, adding their bet.
/// 3. Players alternate calling move (non-terminal) or
///    moveAndWin / moveAndTie (terminal).
/// 4. Either player can propose cancel (requires both signatures).
contract TicTacToe is StatefulSmartContract {
    PubKey immutable playerX;
    bigint immutable betAmount;
    ByteString immutable p2pkhPrefix = 0x1976a914;
    ByteString immutable p2pkhSuffix = 0x88ac;

    PubKey playerO = 0x000000000000000000000000000000000000000000000000000000000000000000;
    bigint c0 = 0;
    bigint c1 = 0;
    bigint c2 = 0;
    bigint c3 = 0;
    bigint c4 = 0;
    bigint c5 = 0;
    bigint c6 = 0;
    bigint c7 = 0;
    bigint c8 = 0;
    bigint turn = 0;
    bigint status = 0;

    constructor(PubKey _playerX, bigint _betAmount) {
        playerX = _playerX;
        betAmount = _betAmount;
    }

    /// @notice Player O joins the game.
    function join(PubKey opponentPK, Sig sig) public {
        require(this.status == 0);
        require(checkSig(sig, opponentPK));
        this.playerO = opponentPK;
        this.status = 1;
        this.turn = 1;
    }

    /// @notice Make a non-terminal move. Updates board and flips turn.
    function move(bigint position, PubKey player, Sig sig) public {
        require(this.status == 1);
        require(checkSig(sig, player));
        this.assertCorrectPlayer(player);
        this.placeMove(position);
        if (this.turn == 1) {
            this.turn = 2;
        } else {
            this.turn = 1;
        }
    }

    /// @notice Make a winning move. Terminal method.
    function moveAndWin(bigint position, PubKey player, Sig sig, ByteString changePKH, bigint changeAmount) public {
        require(this.status == 1);
        require(checkSig(sig, player));
        this.assertCorrectPlayer(player);
        this.assertCellEmpty(position);
        require(this.checkWinAfterMove(position, this.turn));

        bigint totalPayout = this.betAmount * 2;
        ByteString payout = cat(cat(num2bin(totalPayout, 8), this.p2pkhPrefix), cat(hash160(player), this.p2pkhSuffix));
        if (changeAmount > 0) {
            ByteString change = cat(cat(num2bin(changeAmount, 8), this.p2pkhPrefix), cat(changePKH, this.p2pkhSuffix));
            require(hash256(cat(payout, change)) == extractOutputHash(this.txPreimage));
        } else {
            require(hash256(payout) == extractOutputHash(this.txPreimage));
        }
    }

    /// @notice Make a move that fills the board (tie). Terminal method.
    function moveAndTie(bigint position, PubKey player, Sig sig, ByteString changePKH, bigint changeAmount) public {
        require(this.status == 1);
        require(checkSig(sig, player));
        this.assertCorrectPlayer(player);
        this.assertCellEmpty(position);
        require(this.countOccupied() == 8);
        require(!this.checkWinAfterMove(position, this.turn));

        ByteString out1 = cat(cat(num2bin(this.betAmount, 8), this.p2pkhPrefix), cat(hash160(this.playerX), this.p2pkhSuffix));
        ByteString out2 = cat(cat(num2bin(this.betAmount, 8), this.p2pkhPrefix), cat(hash160(this.playerO), this.p2pkhSuffix));
        if (changeAmount > 0) {
            ByteString change = cat(cat(num2bin(changeAmount, 8), this.p2pkhPrefix), cat(changePKH, this.p2pkhSuffix));
            require(hash256(cat(cat(out1, out2), change)) == extractOutputHash(this.txPreimage));
        } else {
            require(hash256(cat(out1, out2)) == extractOutputHash(this.txPreimage));
        }
    }

    /// @notice Player X cancels before anyone joins. Terminal method.
    function cancelBeforeJoin(Sig sig, ByteString changePKH, bigint changeAmount) public {
        require(this.status == 0);
        require(checkSig(sig, this.playerX));
        ByteString payout = cat(cat(num2bin(this.betAmount, 8), this.p2pkhPrefix), cat(hash160(this.playerX), this.p2pkhSuffix));
        if (changeAmount > 0) {
            ByteString change = cat(cat(num2bin(changeAmount, 8), this.p2pkhPrefix), cat(changePKH, this.p2pkhSuffix));
            require(hash256(cat(payout, change)) == extractOutputHash(this.txPreimage));
        } else {
            require(hash256(payout) == extractOutputHash(this.txPreimage));
        }
    }

    /// @notice Both players agree to cancel. Terminal method.
    function cancel(Sig sigX, Sig sigO, ByteString changePKH, bigint changeAmount) public {
        ByteString out1 = cat(cat(num2bin(this.betAmount, 8), this.p2pkhPrefix), cat(hash160(this.playerX), this.p2pkhSuffix));
        ByteString out2 = cat(cat(num2bin(this.betAmount, 8), this.p2pkhPrefix), cat(hash160(this.playerO), this.p2pkhSuffix));
        if (changeAmount > 0) {
            ByteString change = cat(cat(num2bin(changeAmount, 8), this.p2pkhPrefix), cat(changePKH, this.p2pkhSuffix));
            require(hash256(cat(cat(out1, out2), change)) == extractOutputHash(this.txPreimage));
        } else {
            require(hash256(cat(out1, out2)) == extractOutputHash(this.txPreimage));
        }
        require(checkSig(sigX, this.playerX));
        require(checkSig(sigO, this.playerO));
    }

    // --- Private helpers ---

    function assertCorrectPlayer(PubKey player) private {
        if (this.turn == 1) {
            require(player == this.playerX);
        } else {
            require(player == this.playerO);
        }
    }

    function assertCellEmpty(bigint position) private {
        if (position == 0) {
            require(this.c0 == 0);
        } else {
            if (position == 1) {
                require(this.c1 == 0);
            } else {
                if (position == 2) {
                    require(this.c2 == 0);
                } else {
                    if (position == 3) {
                        require(this.c3 == 0);
                    } else {
                        if (position == 4) {
                            require(this.c4 == 0);
                        } else {
                            if (position == 5) {
                                require(this.c5 == 0);
                            } else {
                                if (position == 6) {
                                    require(this.c6 == 0);
                                } else {
                                    if (position == 7) {
                                        require(this.c7 == 0);
                                    } else {
                                        if (position == 8) {
                                            require(this.c8 == 0);
                                        } else {
                                            require(false);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    function placeMove(bigint position) private {
        this.assertCellEmpty(position);
        if (position == 0) {
            this.c0 = this.turn;
        } else {
            if (position == 1) {
                this.c1 = this.turn;
            } else {
                if (position == 2) {
                    this.c2 = this.turn;
                } else {
                    if (position == 3) {
                        this.c3 = this.turn;
                    } else {
                        if (position == 4) {
                            this.c4 = this.turn;
                        } else {
                            if (position == 5) {
                                this.c5 = this.turn;
                            } else {
                                if (position == 6) {
                                    this.c6 = this.turn;
                                } else {
                                    if (position == 7) {
                                        this.c7 = this.turn;
                                    } else {
                                        if (position == 8) {
                                            this.c8 = this.turn;
                                        } else {
                                            require(false);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    function getCellOrOverride(bigint cellIndex, bigint overridePos, bigint overrideVal) private returns (bigint) {
        if (cellIndex == overridePos) {
            return overrideVal;
        }
        if (cellIndex == 0) {
            return this.c0;
        } else {
            if (cellIndex == 1) {
                return this.c1;
            } else {
                if (cellIndex == 2) {
                    return this.c2;
                } else {
                    if (cellIndex == 3) {
                        return this.c3;
                    } else {
                        if (cellIndex == 4) {
                            return this.c4;
                        } else {
                            if (cellIndex == 5) {
                                return this.c5;
                            } else {
                                if (cellIndex == 6) {
                                    return this.c6;
                                } else {
                                    if (cellIndex == 7) {
                                        return this.c7;
                                    } else {
                                        return this.c8;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    function checkWinAfterMove(bigint position, bigint player) private returns (bool) {
        bigint v0 = this.getCellOrOverride(0, position, player);
        bigint v1 = this.getCellOrOverride(1, position, player);
        bigint v2 = this.getCellOrOverride(2, position, player);
        bigint v3 = this.getCellOrOverride(3, position, player);
        bigint v4 = this.getCellOrOverride(4, position, player);
        bigint v5 = this.getCellOrOverride(5, position, player);
        bigint v6 = this.getCellOrOverride(6, position, player);
        bigint v7 = this.getCellOrOverride(7, position, player);
        bigint v8 = this.getCellOrOverride(8, position, player);

        if (v0 == player && v1 == player && v2 == player) { return true; }
        if (v3 == player && v4 == player && v5 == player) { return true; }
        if (v6 == player && v7 == player && v8 == player) { return true; }
        if (v0 == player && v3 == player && v6 == player) { return true; }
        if (v1 == player && v4 == player && v7 == player) { return true; }
        if (v2 == player && v5 == player && v8 == player) { return true; }
        if (v0 == player && v4 == player && v8 == player) { return true; }
        if (v2 == player && v4 == player && v6 == player) { return true; }
        return false;
    }

    function countOccupied() private returns (bigint) {
        bigint count = 0;
        if (this.c0 != 0) { count = count + 1; }
        if (this.c1 != 0) { count = count + 1; }
        if (this.c2 != 0) { count = count + 1; }
        if (this.c3 != 0) { count = count + 1; }
        if (this.c4 != 0) { count = count + 1; }
        if (this.c5 != 0) { count = count + 1; }
        if (this.c6 != 0) { count = count + 1; }
        if (this.c7 != 0) { count = count + 1; }
        if (this.c8 != 0) { count = count + 1; }
        return count;
    }
}
`,
    constructorArgs: {
      playerX: ALICE.pubKey,
      betAmount: 10000n,
    },
    methodCall: {
      method: 'join',
      args: [
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: 'On-chain Tic-Tac-Toe game. Two players bet and compete, rules enforced by Bitcoin Script.',
  },
  {
    id: 'move-tic-tac-toe',
    name: 'Tic-Tac-Toe (Move)',
    language: 'move',
    source: `// On-chain Tic-Tac-Toe contract.
//
// Two players compete on a 3x3 board. Each move is an on-chain transaction.
// The contract holds both players' bets and enforces correct game rules
// entirely in Bitcoin Script.
//
// Board encoding:
// Since Runar has no arrays, the 3x3 board uses 9 individual bigint fields
// (c0-c8). Values: 0=empty, 1=X, 2=O.
//
// Lifecycle:
// 1. Player X deploys the contract with their bet amount.
// 2. Player O calls join to enter the game, adding their bet.
// 3. Players alternate calling move (non-terminal) or
//    move_and_win / move_and_tie (terminal).
// 4. Either player can propose cancel (requires both signatures).
module TicTacToe {
    use runar::StatefulSmartContract;
    use runar::types::{PubKey, Sig, ByteString};
    use runar::crypto::{check_sig, hash256, hash160, extract_output_hash, num2bin, cat};

    resource struct TicTacToe {
        player_x: PubKey,
        bet_amount: bigint,
        p2pkh_prefix: ByteString = 0x1976a914,
        p2pkh_suffix: ByteString = 0x88ac,
        player_o: &mut PubKey = 0x000000000000000000000000000000000000000000000000000000000000000000,
        c0: &mut bigint = 0,
        c1: &mut bigint = 0,
        c2: &mut bigint = 0,
        c3: &mut bigint = 0,
        c4: &mut bigint = 0,
        c5: &mut bigint = 0,
        c6: &mut bigint = 0,
        c7: &mut bigint = 0,
        c8: &mut bigint = 0,
        turn: &mut bigint = 0,
        status: &mut bigint = 0,
    }

    // Player O joins the game.
    public fun join(opponent_pk: PubKey, sig: Sig) {
        assert!(self.status == 0, 0);
        assert!(check_sig(sig, opponent_pk), 0);
        self.player_o = opponent_pk;
        self.status = 1;
        self.turn = 1;
    }

    // Make a non-terminal move. Updates board and flips turn.
    public fun move(position: bigint, player: PubKey, sig: Sig) {
        assert!(self.status == 1, 0);
        assert!(check_sig(sig, player), 0);
        assert_correct_player(player);
        place_move(position);
        if (self.turn == 1) {
            self.turn = 2;
        } else {
            self.turn = 1;
        }
    }

    // Make a winning move. Terminal method.
    public fun move_and_win(position: bigint, player: PubKey, sig: Sig, change_pkh: ByteString, change_amount: bigint) {
        assert!(self.status == 1, 0);
        assert!(check_sig(sig, player), 0);
        assert_correct_player(player);
        assert_cell_empty(position);
        assert!(check_win_after_move(position, self.turn), 0);

        let total_payout: bigint = self.bet_amount * 2;
        let payout: ByteString = cat(cat(num2bin(total_payout, 8), self.p2pkh_prefix), cat(hash160(player), self.p2pkh_suffix));
        if (change_amount > 0) {
            let change: ByteString = cat(cat(num2bin(change_amount, 8), self.p2pkh_prefix), cat(change_pkh, self.p2pkh_suffix));
            assert!(hash256(cat(payout, change)) == extract_output_hash(self.tx_preimage), 0);
        } else {
            assert!(hash256(payout) == extract_output_hash(self.tx_preimage), 0);
        }
    }

    // Make a move that fills the board (tie). Terminal method.
    public fun move_and_tie(position: bigint, player: PubKey, sig: Sig, change_pkh: ByteString, change_amount: bigint) {
        assert!(self.status == 1, 0);
        assert!(check_sig(sig, player), 0);
        assert_correct_player(player);
        assert_cell_empty(position);
        assert!(count_occupied() == 8, 0);
        assert!(!check_win_after_move(position, self.turn), 0);

        let out1: ByteString = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_x), self.p2pkh_suffix));
        let out2: ByteString = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_o), self.p2pkh_suffix));
        if (change_amount > 0) {
            let change: ByteString = cat(cat(num2bin(change_amount, 8), self.p2pkh_prefix), cat(change_pkh, self.p2pkh_suffix));
            assert!(hash256(cat(cat(out1, out2), change)) == extract_output_hash(self.tx_preimage), 0);
        } else {
            assert!(hash256(cat(out1, out2)) == extract_output_hash(self.tx_preimage), 0);
        }
    }

    // Player X cancels before anyone joins. Terminal method.
    public fun cancel_before_join(sig: Sig, change_pkh: ByteString, change_amount: bigint) {
        assert!(self.status == 0, 0);
        assert!(check_sig(sig, self.player_x), 0);
        let payout: ByteString = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_x), self.p2pkh_suffix));
        if (change_amount > 0) {
            let change: ByteString = cat(cat(num2bin(change_amount, 8), self.p2pkh_prefix), cat(change_pkh, self.p2pkh_suffix));
            assert!(hash256(cat(payout, change)) == extract_output_hash(self.tx_preimage), 0);
        } else {
            assert!(hash256(payout) == extract_output_hash(self.tx_preimage), 0);
        }
    }

    // Both players agree to cancel. Terminal method.
    public fun cancel(sig_x: Sig, sig_o: Sig, change_pkh: ByteString, change_amount: bigint) {
        let out1: ByteString = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_x), self.p2pkh_suffix));
        let out2: ByteString = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_o), self.p2pkh_suffix));
        if (change_amount > 0) {
            let change: ByteString = cat(cat(num2bin(change_amount, 8), self.p2pkh_prefix), cat(change_pkh, self.p2pkh_suffix));
            assert!(hash256(cat(cat(out1, out2), change)) == extract_output_hash(self.tx_preimage), 0);
        } else {
            assert!(hash256(cat(out1, out2)) == extract_output_hash(self.tx_preimage), 0);
        }
        assert!(check_sig(sig_x, self.player_x), 0);
        assert!(check_sig(sig_o, self.player_o), 0);
    }

    // --- Private helpers ---

    fun assert_correct_player(player: PubKey) {
        if (self.turn == 1) {
            assert!(player == self.player_x, 0);
        } else {
            assert!(player == self.player_o, 0);
        }
    }

    fun assert_cell_empty(position: bigint) {
        if (position == 0) {
            assert!(self.c0 == 0, 0);
        } else {
            if (position == 1) {
                assert!(self.c1 == 0, 0);
            } else {
                if (position == 2) {
                    assert!(self.c2 == 0, 0);
                } else {
                    if (position == 3) {
                        assert!(self.c3 == 0, 0);
                    } else {
                        if (position == 4) {
                            assert!(self.c4 == 0, 0);
                        } else {
                            if (position == 5) {
                                assert!(self.c5 == 0, 0);
                            } else {
                                if (position == 6) {
                                    assert!(self.c6 == 0, 0);
                                } else {
                                    if (position == 7) {
                                        assert!(self.c7 == 0, 0);
                                    } else {
                                        if (position == 8) {
                                            assert!(self.c8 == 0, 0);
                                        } else {
                                            assert!(false, 0);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fun place_move(position: bigint) {
        assert_cell_empty(position);
        if (position == 0) {
            self.c0 = self.turn;
        } else {
            if (position == 1) {
                self.c1 = self.turn;
            } else {
                if (position == 2) {
                    self.c2 = self.turn;
                } else {
                    if (position == 3) {
                        self.c3 = self.turn;
                    } else {
                        if (position == 4) {
                            self.c4 = self.turn;
                        } else {
                            if (position == 5) {
                                self.c5 = self.turn;
                            } else {
                                if (position == 6) {
                                    self.c6 = self.turn;
                                } else {
                                    if (position == 7) {
                                        self.c7 = self.turn;
                                    } else {
                                        if (position == 8) {
                                            self.c8 = self.turn;
                                        } else {
                                            assert!(false, 0);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fun get_cell_or_override(cell_index: bigint, override_pos: bigint, override_val: bigint): bigint {
        if (cell_index == override_pos) {
            return override_val;
        }
        if (cell_index == 0) {
            return self.c0;
        } else {
            if (cell_index == 1) {
                return self.c1;
            } else {
                if (cell_index == 2) {
                    return self.c2;
                } else {
                    if (cell_index == 3) {
                        return self.c3;
                    } else {
                        if (cell_index == 4) {
                            return self.c4;
                        } else {
                            if (cell_index == 5) {
                                return self.c5;
                            } else {
                                if (cell_index == 6) {
                                    return self.c6;
                                } else {
                                    if (cell_index == 7) {
                                        return self.c7;
                                    } else {
                                        return self.c8;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fun check_win_after_move(position: bigint, player: bigint): bool {
        let v0: bigint = get_cell_or_override(0, position, player);
        let v1: bigint = get_cell_or_override(1, position, player);
        let v2: bigint = get_cell_or_override(2, position, player);
        let v3: bigint = get_cell_or_override(3, position, player);
        let v4: bigint = get_cell_or_override(4, position, player);
        let v5: bigint = get_cell_or_override(5, position, player);
        let v6: bigint = get_cell_or_override(6, position, player);
        let v7: bigint = get_cell_or_override(7, position, player);
        let v8: bigint = get_cell_or_override(8, position, player);

        if (v0 == player && v1 == player && v2 == player) { return true; }
        if (v3 == player && v4 == player && v5 == player) { return true; }
        if (v6 == player && v7 == player && v8 == player) { return true; }
        if (v0 == player && v3 == player && v6 == player) { return true; }
        if (v1 == player && v4 == player && v7 == player) { return true; }
        if (v2 == player && v5 == player && v8 == player) { return true; }
        if (v0 == player && v4 == player && v8 == player) { return true; }
        if (v2 == player && v4 == player && v6 == player) { return true; }
        return false;
    }

    fun count_occupied(): bigint {
        let count: bigint = 0;
        if (self.c0 != 0) { count = count + 1; }
        if (self.c1 != 0) { count = count + 1; }
        if (self.c2 != 0) { count = count + 1; }
        if (self.c3 != 0) { count = count + 1; }
        if (self.c4 != 0) { count = count + 1; }
        if (self.c5 != 0) { count = count + 1; }
        if (self.c6 != 0) { count = count + 1; }
        if (self.c7 != 0) { count = count + 1; }
        if (self.c8 != 0) { count = count + 1; }
        return count;
    }
}
`,
    constructorArgs: {
      playerX: ALICE.pubKey,
      betAmount: 10000n,
    },
    methodCall: {
      method: 'join',
      args: [
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: 'On-chain Tic-Tac-Toe game. Two players bet and compete, rules enforced by Bitcoin Script.',
  },
  {
    id: 'go-tic-tac-toe',
    name: 'Tic-Tac-Toe (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// TicTacToe is an on-chain Tic-Tac-Toe contract.
//
// Two players compete on a 3x3 board. Each move is an on-chain transaction.
// The contract holds both players' bets and enforces correct game rules
// entirely in Bitcoin Script.
//
// Board encoding:
// Since Rúnar has no arrays, the 3x3 board uses 9 individual bigint fields
// (C0-C8). Values: 0=empty, 1=X, 2=O.
//
// Lifecycle:
//  1. Player X deploys the contract with their bet amount.
//  2. Player O calls Join to enter the game, adding their bet.
//  3. Players alternate calling Move (non-terminal) or
//     MoveAndWin / MoveAndTie (terminal).
//  4. Either player can propose Cancel (requires both signatures).
//
// Method types:
//   - State-mutating: Join, Move — produce a continuation UTXO.
//   - Non-mutating terminal: MoveAndWin, MoveAndTie, Cancel — spend
//     the UTXO and enforce payout outputs via ExtractOutputHash.
type TicTacToe struct {
	runar.StatefulSmartContract
	PlayerX     runar.PubKey      \`runar:"readonly"\`
	BetAmount   runar.Bigint      \`runar:"readonly"\`
	P2pkhPrefix runar.ByteString  \`runar:"readonly"\`
	P2pkhSuffix runar.ByteString  \`runar:"readonly"\`
	PlayerO     runar.PubKey
	C0          runar.Bigint
	C1          runar.Bigint
	C2          runar.Bigint
	C3          runar.Bigint
	C4          runar.Bigint
	C5          runar.Bigint
	C6          runar.Bigint
	C7          runar.Bigint
	C8          runar.Bigint
	Turn        runar.Bigint
	Status      runar.Bigint
}

func (c *TicTacToe) init() {
	c.P2pkhPrefix = "1976a914"
	c.P2pkhSuffix = "88ac"
	c.PlayerO = "000000000000000000000000000000000000000000000000000000000000000000"
	c.C0 = 0
	c.C1 = 0
	c.C2 = 0
	c.C3 = 0
	c.C4 = 0
	c.C5 = 0
	c.C6 = 0
	c.C7 = 0
	c.C8 = 0
	c.Turn = 0
	c.Status = 0
}

// Join allows Player O to join the game.
// State-mutating: produces continuation UTXO with doubled bet.
func (c *TicTacToe) Join(opponentPK runar.PubKey, sig runar.Sig) {
	runar.Assert(c.Status == 0)
	runar.Assert(runar.CheckSig(sig, opponentPK))
	c.PlayerO = opponentPK
	c.Status = 1
	c.Turn = 1
}

// Move makes a non-terminal move. Updates board and flips turn.
// State-mutating: produces continuation UTXO.
// Caller provides their pubkey; contract verifies it matches the expected turn.
func (c *TicTacToe) Move(position runar.Bigint, player runar.PubKey, sig runar.Sig) {
	runar.Assert(c.Status == 1)
	runar.Assert(runar.CheckSig(sig, player))
	c.assertCorrectPlayer(player)
	c.placeMove(position)
	if c.Turn == 1 {
		c.Turn = 2
	} else {
		c.Turn = 1
	}
}

// MoveAndWin makes a winning move. Non-mutating terminal method.
// Enforces winner-gets-all payout via ExtractOutputHash.
// Supports optional change output for fee funding.
func (c *TicTacToe) MoveAndWin(position runar.Bigint, player runar.PubKey, sig runar.Sig, changePKH runar.ByteString, changeAmount runar.Bigint) {
	runar.Assert(c.Status == 1)
	runar.Assert(runar.CheckSig(sig, player))
	c.assertCorrectPlayer(player)
	c.assertCellEmpty(position)
	runar.Assert(c.checkWinAfterMove(position, c.Turn))

	totalPayout := c.BetAmount * 2
	payout := runar.Cat(runar.Cat(runar.Num2Bin(totalPayout, 8), c.P2pkhPrefix), runar.Cat(runar.Hash160(player), c.P2pkhSuffix))
	if changeAmount > 0 {
		change := runar.Cat(runar.Cat(runar.Num2Bin(changeAmount, 8), c.P2pkhPrefix), runar.Cat(changePKH, c.P2pkhSuffix))
		runar.Assert(runar.Hash256(runar.Cat(payout, change)) == runar.ExtractOutputHash(c.TxPreimage))
	} else {
		runar.Assert(runar.Hash256(payout) == runar.ExtractOutputHash(c.TxPreimage))
	}
}

// MoveAndTie makes a move that fills the board (tie). Non-mutating terminal method.
// Enforces equal split payout via ExtractOutputHash.
// Supports optional change output for fee funding.
func (c *TicTacToe) MoveAndTie(position runar.Bigint, player runar.PubKey, sig runar.Sig, changePKH runar.ByteString, changeAmount runar.Bigint) {
	runar.Assert(c.Status == 1)
	runar.Assert(runar.CheckSig(sig, player))
	c.assertCorrectPlayer(player)
	c.assertCellEmpty(position)
	runar.Assert(c.countOccupied() == 8)
	runar.Assert(!c.checkWinAfterMove(position, c.Turn))

	out1 := runar.Cat(runar.Cat(runar.Num2Bin(c.BetAmount, 8), c.P2pkhPrefix), runar.Cat(runar.Hash160(c.PlayerX), c.P2pkhSuffix))
	out2 := runar.Cat(runar.Cat(runar.Num2Bin(c.BetAmount, 8), c.P2pkhPrefix), runar.Cat(runar.Hash160(c.PlayerO), c.P2pkhSuffix))
	if changeAmount > 0 {
		change := runar.Cat(runar.Cat(runar.Num2Bin(changeAmount, 8), c.P2pkhPrefix), runar.Cat(changePKH, c.P2pkhSuffix))
		runar.Assert(runar.Hash256(runar.Cat(runar.Cat(out1, out2), change)) == runar.ExtractOutputHash(c.TxPreimage))
	} else {
		runar.Assert(runar.Hash256(runar.Cat(out1, out2)) == runar.ExtractOutputHash(c.TxPreimage))
	}
}

// CancelBeforeJoin lets Player X cancel before anyone joins. Non-mutating terminal method.
// Refunds the full bet to Player X.
// Supports optional change output for fee funding.
func (c *TicTacToe) CancelBeforeJoin(sig runar.Sig, changePKH runar.ByteString, changeAmount runar.Bigint) {
	runar.Assert(c.Status == 0)
	runar.Assert(runar.CheckSig(sig, c.PlayerX))
	payout := runar.Cat(runar.Cat(runar.Num2Bin(c.BetAmount, 8), c.P2pkhPrefix), runar.Cat(runar.Hash160(c.PlayerX), c.P2pkhSuffix))
	if changeAmount > 0 {
		change := runar.Cat(runar.Cat(runar.Num2Bin(changeAmount, 8), c.P2pkhPrefix), runar.Cat(changePKH, c.P2pkhSuffix))
		runar.Assert(runar.Hash256(runar.Cat(payout, change)) == runar.ExtractOutputHash(c.TxPreimage))
	} else {
		runar.Assert(runar.Hash256(payout) == runar.ExtractOutputHash(c.TxPreimage))
	}
}

// Cancel lets both players agree to cancel. Non-mutating terminal method.
// Enforces equal refund via ExtractOutputHash.
// Supports optional change output for fee funding.
func (c *TicTacToe) Cancel(sigX runar.Sig, sigO runar.Sig, changePKH runar.ByteString, changeAmount runar.Bigint) {
	out1 := runar.Cat(runar.Cat(runar.Num2Bin(c.BetAmount, 8), c.P2pkhPrefix), runar.Cat(runar.Hash160(c.PlayerX), c.P2pkhSuffix))
	out2 := runar.Cat(runar.Cat(runar.Num2Bin(c.BetAmount, 8), c.P2pkhPrefix), runar.Cat(runar.Hash160(c.PlayerO), c.P2pkhSuffix))
	if changeAmount > 0 {
		change := runar.Cat(runar.Cat(runar.Num2Bin(changeAmount, 8), c.P2pkhPrefix), runar.Cat(changePKH, c.P2pkhSuffix))
		runar.Assert(runar.Hash256(runar.Cat(runar.Cat(out1, out2), change)) == runar.ExtractOutputHash(c.TxPreimage))
	} else {
		runar.Assert(runar.Hash256(runar.Cat(out1, out2)) == runar.ExtractOutputHash(c.TxPreimage))
	}
	runar.Assert(runar.CheckSig(sigX, c.PlayerX))
	runar.Assert(runar.CheckSig(sigO, c.PlayerO))
}

// --- Private helpers ---

// assertCorrectPlayer asserts the provided player pubkey matches whoever's turn it is.
func (c *TicTacToe) assertCorrectPlayer(player runar.PubKey) {
	if c.Turn == 1 {
		runar.Assert(player == c.PlayerX)
	} else {
		runar.Assert(player == c.PlayerO)
	}
}

func (c *TicTacToe) assertCellEmpty(position runar.Bigint) {
	if position == 0 {
		runar.Assert(c.C0 == 0)
	} else if position == 1 {
		runar.Assert(c.C1 == 0)
	} else if position == 2 {
		runar.Assert(c.C2 == 0)
	} else if position == 3 {
		runar.Assert(c.C3 == 0)
	} else if position == 4 {
		runar.Assert(c.C4 == 0)
	} else if position == 5 {
		runar.Assert(c.C5 == 0)
	} else if position == 6 {
		runar.Assert(c.C6 == 0)
	} else if position == 7 {
		runar.Assert(c.C7 == 0)
	} else if position == 8 {
		runar.Assert(c.C8 == 0)
	} else {
		runar.Assert(false)
	}
}

func (c *TicTacToe) placeMove(position runar.Bigint) {
	c.assertCellEmpty(position)
	if position == 0 {
		c.C0 = c.Turn
	} else if position == 1 {
		c.C1 = c.Turn
	} else if position == 2 {
		c.C2 = c.Turn
	} else if position == 3 {
		c.C3 = c.Turn
	} else if position == 4 {
		c.C4 = c.Turn
	} else if position == 5 {
		c.C5 = c.Turn
	} else if position == 6 {
		c.C6 = c.Turn
	} else if position == 7 {
		c.C7 = c.Turn
	} else if position == 8 {
		c.C8 = c.Turn
	} else {
		runar.Assert(false)
	}
}

func (c *TicTacToe) getCellOrOverride(cellIndex runar.Bigint, overridePos runar.Bigint, overrideVal runar.Bigint) runar.Bigint {
	if cellIndex == overridePos {
		return overrideVal
	}
	if cellIndex == 0 {
		return c.C0
	} else if cellIndex == 1 {
		return c.C1
	} else if cellIndex == 2 {
		return c.C2
	} else if cellIndex == 3 {
		return c.C3
	} else if cellIndex == 4 {
		return c.C4
	} else if cellIndex == 5 {
		return c.C5
	} else if cellIndex == 6 {
		return c.C6
	} else if cellIndex == 7 {
		return c.C7
	} else {
		return c.C8
	}
}

func (c *TicTacToe) checkWinAfterMove(position runar.Bigint, player runar.Bigint) runar.Bool {
	v0 := c.getCellOrOverride(0, position, player)
	v1 := c.getCellOrOverride(1, position, player)
	v2 := c.getCellOrOverride(2, position, player)
	v3 := c.getCellOrOverride(3, position, player)
	v4 := c.getCellOrOverride(4, position, player)
	v5 := c.getCellOrOverride(5, position, player)
	v6 := c.getCellOrOverride(6, position, player)
	v7 := c.getCellOrOverride(7, position, player)
	v8 := c.getCellOrOverride(8, position, player)

	if v0 == player && v1 == player && v2 == player {
		return true
	}
	if v3 == player && v4 == player && v5 == player {
		return true
	}
	if v6 == player && v7 == player && v8 == player {
		return true
	}
	if v0 == player && v3 == player && v6 == player {
		return true
	}
	if v1 == player && v4 == player && v7 == player {
		return true
	}
	if v2 == player && v5 == player && v8 == player {
		return true
	}
	if v0 == player && v4 == player && v8 == player {
		return true
	}
	if v2 == player && v4 == player && v6 == player {
		return true
	}
	return false
}

func (c *TicTacToe) countOccupied() runar.Bigint {
	count := runar.Bigint(0)
	if c.C0 != 0 {
		count = count + 1
	}
	if c.C1 != 0 {
		count = count + 1
	}
	if c.C2 != 0 {
		count = count + 1
	}
	if c.C3 != 0 {
		count = count + 1
	}
	if c.C4 != 0 {
		count = count + 1
	}
	if c.C5 != 0 {
		count = count + 1
	}
	if c.C6 != 0 {
		count = count + 1
	}
	if c.C7 != 0 {
		count = count + 1
	}
	if c.C8 != 0 {
		count = count + 1
	}
	return count
}
`,
    constructorArgs: {
      playerX: ALICE.pubKey,
      betAmount: 10000n,
    },
    methodCall: {
      method: 'join',
      args: [
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: 'On-chain Tic-Tac-Toe game. Two players bet and compete, rules enforced by Bitcoin Script.',
  },
  {
    id: 'rust-tic-tac-toe',
    name: 'Tic-Tac-Toe (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// On-chain Tic-Tac-Toe contract.
///
/// Two players compete on a 3x3 board. Each move is an on-chain transaction.
/// The contract holds both players' bets and enforces correct game rules
/// entirely in Bitcoin Script.
///
/// Board encoding:
/// Since Runar has no arrays, the 3x3 board uses 9 individual bigint fields
/// (c0-c8). Values: 0=empty, 1=X, 2=O.
///
/// Lifecycle:
///  1. Player X deploys the contract with their bet amount.
///  2. Player O calls \`join\` to enter the game, adding their bet.
///  3. Players alternate calling \`move_piece\` (non-terminal) or
///     \`move_and_win\` / \`move_and_tie\` (terminal).
///  4. Either player can propose \`cancel\` (requires both signatures).
///
/// Method types:
///   - State-mutating: \`join\`, \`move_piece\` -- produce a continuation UTXO.
///   - Non-mutating terminal: \`move_and_win\`, \`move_and_tie\`, \`cancel\` -- spend
///     the UTXO and enforce payout outputs via extract_output_hash.
#[runar::contract]
pub struct TicTacToe {
    #[readonly]
    pub player_x: PubKey,
    #[readonly]
    pub bet_amount: Bigint,
    #[readonly]
    pub p2pkh_prefix: ByteString,
    #[readonly]
    pub p2pkh_suffix: ByteString,
    pub player_o: PubKey,
    pub c0: Bigint,
    pub c1: Bigint,
    pub c2: Bigint,
    pub c3: Bigint,
    pub c4: Bigint,
    pub c5: Bigint,
    pub c6: Bigint,
    pub c7: Bigint,
    pub c8: Bigint,
    pub turn: Bigint,
    pub status: Bigint,
    pub tx_preimage: SigHashPreimage,
}

#[runar::methods(TicTacToe)]
impl TicTacToe {
    pub fn init(&mut self) {
        self.p2pkh_prefix = "1976a914";
        self.p2pkh_suffix = "88ac";
        self.player_o = "000000000000000000000000000000000000000000000000000000000000000000";
        self.c0 = 0;
        self.c1 = 0;
        self.c2 = 0;
        self.c3 = 0;
        self.c4 = 0;
        self.c5 = 0;
        self.c6 = 0;
        self.c7 = 0;
        self.c8 = 0;
        self.turn = 0;
        self.status = 0;
    }

    /// Player O joins the game.
    /// State-mutating: produces continuation UTXO with doubled bet.
    #[public]
    pub fn join(&mut self, opponent_pk: PubKey, sig: &Sig) {
        assert!(self.status == 0);
        assert!(check_sig(sig, &opponent_pk));
        self.player_o = opponent_pk;
        self.status = 1;
        self.turn = 1;
    }

    /// Make a non-terminal move. Updates board and flips turn.
    /// State-mutating: produces continuation UTXO.
    /// Caller provides their pubkey; contract verifies it matches the expected turn.
    #[public]
    pub fn move_piece(&mut self, position: Bigint, player: PubKey, sig: &Sig) {
        assert!(self.status == 1);
        assert!(check_sig(sig, &player));
        self.assert_correct_player(player.clone());
        self.place_move(position);
        if self.turn == 1 {
            self.turn = 2;
        } else {
            self.turn = 1;
        }
    }

    /// Make a winning move. Non-mutating terminal method.
    /// Enforces winner-gets-all payout via extract_output_hash.
    /// Supports optional change output for fee funding.
    #[public]
    pub fn move_and_win(&mut self, position: Bigint, player: PubKey, sig: &Sig, change_pkh: ByteString, change_amount: Bigint) {
        assert!(self.status == 1);
        assert!(check_sig(sig, &player));
        self.assert_correct_player(player.clone());
        self.assert_cell_empty(position);
        assert!(self.check_win_after_move(position, self.turn));

        let total_payout = self.bet_amount * 2;
        let payout = cat(&cat(&num2bin(&total_payout, 8), &self.p2pkh_prefix), &cat(&hash160(&player), &self.p2pkh_suffix));
        if change_amount > 0 {
            let change = cat(&cat(&num2bin(&change_amount, 8), &self.p2pkh_prefix), &cat(&change_pkh, &self.p2pkh_suffix));
            assert!(hash256(&cat(&payout, &change)) == extract_output_hash(&self.tx_preimage));
        } else {
            assert!(hash256(&payout) == extract_output_hash(&self.tx_preimage));
        }
    }

    /// Make a move that fills the board (tie). Non-mutating terminal method.
    /// Enforces equal split payout via extract_output_hash.
    /// Supports optional change output for fee funding.
    #[public]
    pub fn move_and_tie(&mut self, position: Bigint, player: PubKey, sig: &Sig, change_pkh: ByteString, change_amount: Bigint) {
        assert!(self.status == 1);
        assert!(check_sig(sig, &player));
        self.assert_correct_player(player.clone());
        self.assert_cell_empty(position);
        assert!(self.count_occupied() == 8);
        assert!(!self.check_win_after_move(position, self.turn));

        let out1 = cat(&cat(&num2bin(&self.bet_amount, 8), &self.p2pkh_prefix), &cat(&hash160(&self.player_x), &self.p2pkh_suffix));
        let out2 = cat(&cat(&num2bin(&self.bet_amount, 8), &self.p2pkh_prefix), &cat(&hash160(&self.player_o), &self.p2pkh_suffix));
        if change_amount > 0 {
            let change = cat(&cat(&num2bin(&change_amount, 8), &self.p2pkh_prefix), &cat(&change_pkh, &self.p2pkh_suffix));
            assert!(hash256(&cat(&cat(&out1, &out2), &change)) == extract_output_hash(&self.tx_preimage));
        } else {
            assert!(hash256(&cat(&out1, &out2)) == extract_output_hash(&self.tx_preimage));
        }
    }

    /// Player X cancels before anyone joins. Non-mutating terminal method.
    /// Refunds the full bet to player X.
    /// Supports optional change output for fee funding.
    #[public]
    pub fn cancel_before_join(&mut self, sig: &Sig, change_pkh: ByteString, change_amount: Bigint) {
        assert!(self.status == 0);
        assert!(check_sig(sig, &self.player_x));
        let payout = cat(&cat(&num2bin(&self.bet_amount, 8), &self.p2pkh_prefix), &cat(&hash160(&self.player_x), &self.p2pkh_suffix));
        if change_amount > 0 {
            let change = cat(&cat(&num2bin(&change_amount, 8), &self.p2pkh_prefix), &cat(&change_pkh, &self.p2pkh_suffix));
            assert!(hash256(&cat(&payout, &change)) == extract_output_hash(&self.tx_preimage));
        } else {
            assert!(hash256(&payout) == extract_output_hash(&self.tx_preimage));
        }
    }

    /// Both players agree to cancel. Non-mutating terminal method.
    /// Enforces equal refund via extract_output_hash.
    /// Supports optional change output for fee funding.
    #[public]
    pub fn cancel(&mut self, sig_x: &Sig, sig_o: &Sig, change_pkh: ByteString, change_amount: Bigint) {
        let out1 = cat(&cat(&num2bin(&self.bet_amount, 8), &self.p2pkh_prefix), &cat(&hash160(&self.player_x), &self.p2pkh_suffix));
        let out2 = cat(&cat(&num2bin(&self.bet_amount, 8), &self.p2pkh_prefix), &cat(&hash160(&self.player_o), &self.p2pkh_suffix));
        if change_amount > 0 {
            let change = cat(&cat(&num2bin(&change_amount, 8), &self.p2pkh_prefix), &cat(&change_pkh, &self.p2pkh_suffix));
            assert!(hash256(&cat(&cat(&out1, &out2), &change)) == extract_output_hash(&self.tx_preimage));
        } else {
            assert!(hash256(&cat(&out1, &out2)) == extract_output_hash(&self.tx_preimage));
        }
        assert!(check_sig(sig_x, &self.player_x));
        assert!(check_sig(sig_o, &self.player_o));
    }

    // --- Private helpers ---

    /// Assert the provided player pubkey matches whoever's turn it is.
    fn assert_correct_player(&self, player: PubKey) {
        if self.turn == 1 {
            assert!(player == self.player_x);
        } else {
            assert!(player == self.player_o);
        }
    }

    fn assert_cell_empty(&self, position: Bigint) {
        if position == 0 {
            assert!(self.c0 == 0);
        } else {
            if position == 1 {
                assert!(self.c1 == 0);
            } else {
                if position == 2 {
                    assert!(self.c2 == 0);
                } else {
                    if position == 3 {
                        assert!(self.c3 == 0);
                    } else {
                        if position == 4 {
                            assert!(self.c4 == 0);
                        } else {
                            if position == 5 {
                                assert!(self.c5 == 0);
                            } else {
                                if position == 6 {
                                    assert!(self.c6 == 0);
                                } else {
                                    if position == 7 {
                                        assert!(self.c7 == 0);
                                    } else {
                                        if position == 8 {
                                            assert!(self.c8 == 0);
                                        } else {
                                            assert!(1 == 0);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fn place_move(&mut self, position: Bigint) {
        self.assert_cell_empty(position);
        if position == 0 {
            self.c0 = self.turn;
        } else {
            if position == 1 {
                self.c1 = self.turn;
            } else {
                if position == 2 {
                    self.c2 = self.turn;
                } else {
                    if position == 3 {
                        self.c3 = self.turn;
                    } else {
                        if position == 4 {
                            self.c4 = self.turn;
                        } else {
                            if position == 5 {
                                self.c5 = self.turn;
                            } else {
                                if position == 6 {
                                    self.c6 = self.turn;
                                } else {
                                    if position == 7 {
                                        self.c7 = self.turn;
                                    } else {
                                        if position == 8 {
                                            self.c8 = self.turn;
                                        } else {
                                            assert!(1 == 0);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fn get_cell_or_override(&self, cell_index: Bigint, override_pos: Bigint, override_val: Bigint) -> Bigint {
        if cell_index == override_pos {
            return override_val;
        }
        if cell_index == 0 {
            return self.c0;
        } else {
            if cell_index == 1 {
                return self.c1;
            } else {
                if cell_index == 2 {
                    return self.c2;
                } else {
                    if cell_index == 3 {
                        return self.c3;
                    } else {
                        if cell_index == 4 {
                            return self.c4;
                        } else {
                            if cell_index == 5 {
                                return self.c5;
                            } else {
                                if cell_index == 6 {
                                    return self.c6;
                                } else {
                                    if cell_index == 7 {
                                        return self.c7;
                                    } else {
                                        return self.c8;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fn check_win_after_move(&self, position: Bigint, player: Bigint) -> bool {
        let v0 = self.get_cell_or_override(0, position, player);
        let v1 = self.get_cell_or_override(1, position, player);
        let v2 = self.get_cell_or_override(2, position, player);
        let v3 = self.get_cell_or_override(3, position, player);
        let v4 = self.get_cell_or_override(4, position, player);
        let v5 = self.get_cell_or_override(5, position, player);
        let v6 = self.get_cell_or_override(6, position, player);
        let v7 = self.get_cell_or_override(7, position, player);
        let v8 = self.get_cell_or_override(8, position, player);

        if v0 == player && v1 == player && v2 == player { return true; }
        if v3 == player && v4 == player && v5 == player { return true; }
        if v6 == player && v7 == player && v8 == player { return true; }
        if v0 == player && v3 == player && v6 == player { return true; }
        if v1 == player && v4 == player && v7 == player { return true; }
        if v2 == player && v5 == player && v8 == player { return true; }
        if v0 == player && v4 == player && v8 == player { return true; }
        if v2 == player && v4 == player && v6 == player { return true; }
        return false;
    }

    fn count_occupied(&self) -> Bigint {
        let mut count: Bigint = 0;
        if self.c0 != 0 { count = count + 1; }
        if self.c1 != 0 { count = count + 1; }
        if self.c2 != 0 { count = count + 1; }
        if self.c3 != 0 { count = count + 1; }
        if self.c4 != 0 { count = count + 1; }
        if self.c5 != 0 { count = count + 1; }
        if self.c6 != 0 { count = count + 1; }
        if self.c7 != 0 { count = count + 1; }
        if self.c8 != 0 { count = count + 1; }
        return count;
    }
}
`,
    constructorArgs: {
      playerX: ALICE.pubKey,
      betAmount: 10000n,
    },
    methodCall: {
      method: 'join',
      args: [
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: 'On-chain Tic-Tac-Toe game. Two players bet and compete, rules enforced by Bitcoin Script.',
  },
  {
    id: 'python-tic-tac-toe',
    name: 'Tic-Tac-Toe (Python)',
    language: 'python',
    source: `from runar import (
    StatefulSmartContract, PubKey, Sig, ByteString, Bigint, Readonly,
    public, assert_, check_sig, extract_output_hash, hash256, hash160,
    num2bin, cat,
)


class TicTacToe(StatefulSmartContract):
    # On-chain Tic-Tac-Toe contract.
    #
    # Two players compete on a 3x3 board. Each move is an on-chain transaction.
    # The contract holds both players' bets and enforces correct game rules
    # entirely in Bitcoin Script.
    #
    # Board encoding:
    #   Since Runar has no arrays, the 3x3 board uses 9 individual bigint
    #   fields (c0-c8). Values: 0=empty, 1=X, 2=O.
    #
    # Lifecycle:
    #   1. Player X deploys the contract with their bet amount.
    #   2. Player O calls join() to enter the game, adding their bet.
    #   3. Players alternate calling move() (non-terminal) or
    #      move_and_win() / move_and_tie() (terminal).
    #   4. Either player can propose cancel() (requires both signatures).

    player_x: Readonly[PubKey]
    bet_amount: Readonly[Bigint]
    p2pkh_prefix: Readonly[ByteString] = "1976a914"
    p2pkh_suffix: Readonly[ByteString] = "88ac"

    player_o: PubKey = "000000000000000000000000000000000000000000000000000000000000000000"
    c0: Bigint = 0
    c1: Bigint = 0
    c2: Bigint = 0
    c3: Bigint = 0
    c4: Bigint = 0
    c5: Bigint = 0
    c6: Bigint = 0
    c7: Bigint = 0
    c8: Bigint = 0
    turn: Bigint = 0
    status: Bigint = 0

    def __init__(self, player_x: PubKey, bet_amount: Bigint):
        super().__init__(player_x, bet_amount)
        self.player_x = player_x
        self.bet_amount = bet_amount

    # Player O joins the game.
    # State-mutating: produces continuation UTXO with doubled bet.
    @public
    def join(self, opponent_pk: PubKey, sig: Sig):
        assert_(self.status == 0)
        assert_(check_sig(sig, opponent_pk))
        self.player_o = opponent_pk
        self.status = 1
        self.turn = 1

    # Make a non-terminal move. Updates board and flips turn.
    # State-mutating: produces continuation UTXO.
    @public
    def move(self, position: Bigint, player: PubKey, sig: Sig):
        assert_(self.status == 1)
        assert_(check_sig(sig, player))
        self.assert_correct_player(player)
        self.place_move(position)
        if self.turn == 1:
            self.turn = 2
        else:
            self.turn = 1

    # Make a winning move. Non-mutating terminal method.
    # Enforces winner-gets-all payout via extractOutputHash.
    @public
    def move_and_win(self, position: Bigint, player: PubKey, sig: Sig, change_pkh: ByteString, change_amount: Bigint):
        assert_(self.status == 1)
        assert_(check_sig(sig, player))
        self.assert_correct_player(player)
        self.assert_cell_empty(position)
        assert_(self.check_win_after_move(position, self.turn))

        total_payout = self.bet_amount * 2
        payout = cat(cat(num2bin(total_payout, 8), self.p2pkh_prefix), cat(hash160(player), self.p2pkh_suffix))
        if change_amount > 0:
            change = cat(cat(num2bin(change_amount, 8), self.p2pkh_prefix), cat(change_pkh, self.p2pkh_suffix))
            assert_(hash256(cat(payout, change)) == extract_output_hash(self.tx_preimage))
        else:
            assert_(hash256(payout) == extract_output_hash(self.tx_preimage))

    # Make a move that fills the board (tie). Non-mutating terminal method.
    # Enforces equal split payout via extractOutputHash.
    @public
    def move_and_tie(self, position: Bigint, player: PubKey, sig: Sig, change_pkh: ByteString, change_amount: Bigint):
        assert_(self.status == 1)
        assert_(check_sig(sig, player))
        self.assert_correct_player(player)
        self.assert_cell_empty(position)
        assert_(self.count_occupied() == 8)
        assert_(not self.check_win_after_move(position, self.turn))

        out1 = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_x), self.p2pkh_suffix))
        out2 = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_o), self.p2pkh_suffix))
        if change_amount > 0:
            change = cat(cat(num2bin(change_amount, 8), self.p2pkh_prefix), cat(change_pkh, self.p2pkh_suffix))
            assert_(hash256(cat(cat(out1, out2), change)) == extract_output_hash(self.tx_preimage))
        else:
            assert_(hash256(cat(out1, out2)) == extract_output_hash(self.tx_preimage))

    # Player X cancels before anyone joins. Non-mutating terminal method.
    # Refunds the full bet to player X.
    @public
    def cancel_before_join(self, sig: Sig, change_pkh: ByteString, change_amount: Bigint):
        assert_(self.status == 0)
        assert_(check_sig(sig, self.player_x))
        payout = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_x), self.p2pkh_suffix))
        if change_amount > 0:
            change = cat(cat(num2bin(change_amount, 8), self.p2pkh_prefix), cat(change_pkh, self.p2pkh_suffix))
            assert_(hash256(cat(payout, change)) == extract_output_hash(self.tx_preimage))
        else:
            assert_(hash256(payout) == extract_output_hash(self.tx_preimage))

    # Both players agree to cancel. Non-mutating terminal method.
    # Enforces equal refund via extractOutputHash.
    @public
    def cancel(self, sig_x: Sig, sig_o: Sig, change_pkh: ByteString, change_amount: Bigint):
        out1 = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_x), self.p2pkh_suffix))
        out2 = cat(cat(num2bin(self.bet_amount, 8), self.p2pkh_prefix), cat(hash160(self.player_o), self.p2pkh_suffix))
        if change_amount > 0:
            change = cat(cat(num2bin(change_amount, 8), self.p2pkh_prefix), cat(change_pkh, self.p2pkh_suffix))
            assert_(hash256(cat(cat(out1, out2), change)) == extract_output_hash(self.tx_preimage))
        else:
            assert_(hash256(cat(out1, out2)) == extract_output_hash(self.tx_preimage))
        assert_(check_sig(sig_x, self.player_x))
        assert_(check_sig(sig_o, self.player_o))

    # --- Private helpers ---

    # Assert the provided player pubkey matches whoever's turn it is.
    def assert_correct_player(self, player: PubKey):
        if self.turn == 1:
            assert_(player == self.player_x)
        else:
            assert_(player == self.player_o)

    # Assert the cell at the given position is empty.
    def assert_cell_empty(self, position: Bigint):
        if position == 0:
            assert_(self.c0 == 0)
        elif position == 1:
            assert_(self.c1 == 0)
        elif position == 2:
            assert_(self.c2 == 0)
        elif position == 3:
            assert_(self.c3 == 0)
        elif position == 4:
            assert_(self.c4 == 0)
        elif position == 5:
            assert_(self.c5 == 0)
        elif position == 6:
            assert_(self.c6 == 0)
        elif position == 7:
            assert_(self.c7 == 0)
        elif position == 8:
            assert_(self.c8 == 0)
        else:
            assert_(False)

    # Place the current turn's mark at the given position.
    def place_move(self, position: Bigint):
        self.assert_cell_empty(position)
        if position == 0:
            self.c0 = self.turn
        elif position == 1:
            self.c1 = self.turn
        elif position == 2:
            self.c2 = self.turn
        elif position == 3:
            self.c3 = self.turn
        elif position == 4:
            self.c4 = self.turn
        elif position == 5:
            self.c5 = self.turn
        elif position == 6:
            self.c6 = self.turn
        elif position == 7:
            self.c7 = self.turn
        elif position == 8:
            self.c8 = self.turn
        else:
            assert_(False)

    # Get cell value, overriding the specified position with override_val.
    def get_cell_or_override(self, cell_index: Bigint, override_pos: Bigint, override_val: Bigint) -> Bigint:
        if cell_index == override_pos:
            return override_val
        if cell_index == 0:
            return self.c0
        elif cell_index == 1:
            return self.c1
        elif cell_index == 2:
            return self.c2
        elif cell_index == 3:
            return self.c3
        elif cell_index == 4:
            return self.c4
        elif cell_index == 5:
            return self.c5
        elif cell_index == 6:
            return self.c6
        elif cell_index == 7:
            return self.c7
        else:
            return self.c8

    # Check if placing player's mark at position would create a winning line.
    def check_win_after_move(self, position: Bigint, player: Bigint) -> bool:
        v0 = self.get_cell_or_override(0, position, player)
        v1 = self.get_cell_or_override(1, position, player)
        v2 = self.get_cell_or_override(2, position, player)
        v3 = self.get_cell_or_override(3, position, player)
        v4 = self.get_cell_or_override(4, position, player)
        v5 = self.get_cell_or_override(5, position, player)
        v6 = self.get_cell_or_override(6, position, player)
        v7 = self.get_cell_or_override(7, position, player)
        v8 = self.get_cell_or_override(8, position, player)

        if v0 == player and v1 == player and v2 == player:
            return True
        if v3 == player and v4 == player and v5 == player:
            return True
        if v6 == player and v7 == player and v8 == player:
            return True
        if v0 == player and v3 == player and v6 == player:
            return True
        if v1 == player and v4 == player and v7 == player:
            return True
        if v2 == player and v5 == player and v8 == player:
            return True
        if v0 == player and v4 == player and v8 == player:
            return True
        if v2 == player and v4 == player and v6 == player:
            return True
        return False

    # Count the number of occupied cells on the board.
    def count_occupied(self) -> Bigint:
        count = 0
        if self.c0 != 0:
            count = count + 1
        if self.c1 != 0:
            count = count + 1
        if self.c2 != 0:
            count = count + 1
        if self.c3 != 0:
            count = count + 1
        if self.c4 != 0:
            count = count + 1
        if self.c5 != 0:
            count = count + 1
        if self.c6 != 0:
            count = count + 1
        if self.c7 != 0:
            count = count + 1
        if self.c8 != 0:
            count = count + 1
        return count
`,
    constructorArgs: {
      playerX: ALICE.pubKey,
      betAmount: 10000n,
    },
    methodCall: {
      method: 'join',
      args: [
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: 'On-chain Tic-Tac-Toe game. Two players bet and compete, rules enforced by Bitcoin Script.',
  },
  {
    id: 'zig-tic-tac-toe',
    name: 'Tic-Tac-Toe (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const TicTacToe = struct {
    pub const Contract = runar.StatefulSmartContract;

    playerX: runar.PubKey,
    betAmount: i64,
    playerO: runar.PubKey = "000000000000000000000000000000000000000000000000000000000000000000",
    c0: i64 = 0,
    c1: i64 = 0,
    c2: i64 = 0,
    c3: i64 = 0,
    c4: i64 = 0,
    c5: i64 = 0,
    c6: i64 = 0,
    c7: i64 = 0,
    c8: i64 = 0,
    turn: i64 = 0,
    status: i64 = 0,

    pub fn init(playerX: runar.PubKey, betAmount: i64) TicTacToe {
        return .{
            .playerX = playerX,
            .betAmount = betAmount,
        };
    }

    pub fn join(self: *TicTacToe, opponentPK: runar.PubKey, sig: runar.Sig) void {
        runar.assert(self.status == 0);
        runar.assert(runar.checkSig(sig, opponentPK));
        self.playerO = opponentPK;
        self.status = 1;
        self.turn = 1;
    }

    pub fn move(self: *TicTacToe, position: i64, player: runar.PubKey, sig: runar.Sig) void {
        runar.assert(self.status == 1);
        runar.assert(runar.checkSig(sig, player));
        self.assertCorrectPlayer(player);
        self.placeMove(position);

        if (self.turn == 1) {
            self.turn = 2;
        } else {
            self.turn = 1;
        }
    }

    pub fn moveAndWin(
        self: *const TicTacToe,
        ctx: runar.StatefulContext,
        position: i64,
        player: runar.PubKey,
        sig: runar.Sig,
        changePKH: runar.ByteString,
        changeAmount: i64,
    ) void {
        runar.assert(self.status == 1);
        runar.assert(runar.checkSig(sig, player));
        self.assertCorrectPlayer(player);
        self.assertCellEmpty(position);
        runar.assert(self.checkWinAfterMove(position, self.turn));

        const payout = runar.buildChangeOutput(runar.hash160(player), self.betAmount * 2);
        if (changeAmount > 0) {
            const change = runar.buildChangeOutput(changePKH, changeAmount);
            runar.assert(runar.bytesEq(runar.hash256(runar.cat(payout, change)), runar.extractOutputHash(ctx.txPreimage)));
        } else {
            runar.assert(runar.bytesEq(runar.hash256(payout), runar.extractOutputHash(ctx.txPreimage)));
        }
    }

    pub fn moveAndTie(
        self: *const TicTacToe,
        ctx: runar.StatefulContext,
        position: i64,
        player: runar.PubKey,
        sig: runar.Sig,
        changePKH: runar.ByteString,
        changeAmount: i64,
    ) void {
        runar.assert(self.status == 1);
        runar.assert(runar.checkSig(sig, player));
        self.assertCorrectPlayer(player);
        self.assertCellEmpty(position);
        runar.assert(self.countOccupied() == 8);
        runar.assert(!self.checkWinAfterMove(position, self.turn));

        const out1 = runar.buildChangeOutput(runar.hash160(self.playerX), self.betAmount);
        const out2 = runar.buildChangeOutput(runar.hash160(self.playerO), self.betAmount);
        if (changeAmount > 0) {
            const change = runar.buildChangeOutput(changePKH, changeAmount);
            runar.assert(runar.bytesEq(runar.hash256(runar.cat(runar.cat(out1, out2), change)), runar.extractOutputHash(ctx.txPreimage)));
        } else {
            runar.assert(runar.bytesEq(runar.hash256(runar.cat(out1, out2)), runar.extractOutputHash(ctx.txPreimage)));
        }
    }

    pub fn cancelBeforeJoin(
        self: *const TicTacToe,
        ctx: runar.StatefulContext,
        sig: runar.Sig,
        changePKH: runar.ByteString,
        changeAmount: i64,
    ) void {
        runar.assert(self.status == 0);
        runar.assert(runar.checkSig(sig, self.playerX));

        const payout = runar.buildChangeOutput(runar.hash160(self.playerX), self.betAmount);
        if (changeAmount > 0) {
            const change = runar.buildChangeOutput(changePKH, changeAmount);
            runar.assert(runar.bytesEq(runar.hash256(runar.cat(payout, change)), runar.extractOutputHash(ctx.txPreimage)));
        } else {
            runar.assert(runar.bytesEq(runar.hash256(payout), runar.extractOutputHash(ctx.txPreimage)));
        }
    }

    pub fn cancel(
        self: *const TicTacToe,
        ctx: runar.StatefulContext,
        sigX: runar.Sig,
        sigO: runar.Sig,
        changePKH: runar.ByteString,
        changeAmount: i64,
    ) void {
        const out1 = runar.buildChangeOutput(runar.hash160(self.playerX), self.betAmount);
        const out2 = runar.buildChangeOutput(runar.hash160(self.playerO), self.betAmount);
        if (changeAmount > 0) {
            const change = runar.buildChangeOutput(changePKH, changeAmount);
            runar.assert(runar.bytesEq(runar.hash256(runar.cat(runar.cat(out1, out2), change)), runar.extractOutputHash(ctx.txPreimage)));
        } else {
            runar.assert(runar.bytesEq(runar.hash256(runar.cat(out1, out2)), runar.extractOutputHash(ctx.txPreimage)));
        }

        runar.assert(runar.checkSig(sigX, self.playerX));
        runar.assert(runar.checkSig(sigO, self.playerO));
    }

    fn assertCorrectPlayer(self: *const TicTacToe, player: runar.PubKey) void {
        if (self.turn == 1) {
            runar.assert(runar.bytesEq(player, self.playerX));
        } else {
            runar.assert(runar.bytesEq(player, self.playerO));
        }
    }

    fn assertCellEmpty(self: *const TicTacToe, position: i64) void {
        if (position == 0) {
            runar.assert(self.c0 == 0);
        } else if (position == 1) {
            runar.assert(self.c1 == 0);
        } else if (position == 2) {
            runar.assert(self.c2 == 0);
        } else if (position == 3) {
            runar.assert(self.c3 == 0);
        } else if (position == 4) {
            runar.assert(self.c4 == 0);
        } else if (position == 5) {
            runar.assert(self.c5 == 0);
        } else if (position == 6) {
            runar.assert(self.c6 == 0);
        } else if (position == 7) {
            runar.assert(self.c7 == 0);
        } else if (position == 8) {
            runar.assert(self.c8 == 0);
        } else {
            runar.assert(false);
        }
    }

    fn placeMove(self: *TicTacToe, position: i64) void {
        self.assertCellEmpty(position);
        if (position == 0) {
            self.c0 = self.turn;
        } else if (position == 1) {
            self.c1 = self.turn;
        } else if (position == 2) {
            self.c2 = self.turn;
        } else if (position == 3) {
            self.c3 = self.turn;
        } else if (position == 4) {
            self.c4 = self.turn;
        } else if (position == 5) {
            self.c5 = self.turn;
        } else if (position == 6) {
            self.c6 = self.turn;
        } else if (position == 7) {
            self.c7 = self.turn;
        } else if (position == 8) {
            self.c8 = self.turn;
        } else {
            runar.assert(false);
        }
    }

    fn getCellOrOverride(self: *const TicTacToe, cellIndex: i64, overridePos: i64, overrideVal: i64) i64 {
        if (cellIndex == overridePos) {
            return overrideVal;
        }
        if (cellIndex == 0) {
            return self.c0;
        }
        if (cellIndex == 1) {
            return self.c1;
        }
        if (cellIndex == 2) {
            return self.c2;
        }
        if (cellIndex == 3) {
            return self.c3;
        }
        if (cellIndex == 4) {
            return self.c4;
        }
        if (cellIndex == 5) {
            return self.c5;
        }
        if (cellIndex == 6) {
            return self.c6;
        }
        if (cellIndex == 7) {
            return self.c7;
        }
        return self.c8;
    }

    fn checkWinAfterMove(self: *const TicTacToe, position: i64, player: i64) bool {
        const c0 = self.getCellOrOverride(0, position, player);
        const c1 = self.getCellOrOverride(1, position, player);
        const c2 = self.getCellOrOverride(2, position, player);
        const c3 = self.getCellOrOverride(3, position, player);
        const c4 = self.getCellOrOverride(4, position, player);
        const c5 = self.getCellOrOverride(5, position, player);
        const c6 = self.getCellOrOverride(6, position, player);
        const c7 = self.getCellOrOverride(7, position, player);
        const c8 = self.getCellOrOverride(8, position, player);

        return
            (c0 == player and c1 == player and c2 == player) or
            (c3 == player and c4 == player and c5 == player) or
            (c6 == player and c7 == player and c8 == player) or
            (c0 == player and c3 == player and c6 == player) or
            (c1 == player and c4 == player and c7 == player) or
            (c2 == player and c5 == player and c8 == player) or
            (c0 == player and c4 == player and c8 == player) or
            (c2 == player and c4 == player and c6 == player);
    }

    fn countOccupied(self: *const TicTacToe) i64 {
        var count: i64 = 0;
        if (self.c0 != 0) {
            count += 1;
        }
        if (self.c1 != 0) {
            count += 1;
        }
        if (self.c2 != 0) {
            count += 1;
        }
        if (self.c3 != 0) {
            count += 1;
        }
        if (self.c4 != 0) {
            count += 1;
        }
        if (self.c5 != 0) {
            count += 1;
        }
        if (self.c6 != 0) {
            count += 1;
        }
        if (self.c7 != 0) {
            count += 1;
        }
        if (self.c8 != 0) {
            count += 1;
        }
        return count;
    }
};
`,
    constructorArgs: {
      playerX: ALICE.pubKey,
      betAmount: 10000n,
    },
    methodCall: {
      method: 'join',
      args: [
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: 'On-chain Tic-Tac-Toe game. Two players bet and compete, rules enforced by Bitcoin Script.',
  },
  {
    id: 'ruby-tic-tac-toe',
    name: 'Tic-Tac-Toe (Ruby)',
    language: 'ruby',
    source: `require 'runar'

# TicTacToe -- On-chain Tic-Tac-Toe contract.
#
# Two players compete on a 3x3 board. Each move is an on-chain transaction.
# The contract holds both players' bets and enforces correct game rules
# entirely in Bitcoin Script.
#
# Board encoding:
#   Since Runar has no arrays, the 3x3 board uses 9 individual bigint
#   fields (c0-c8). Values: 0=empty, 1=X, 2=O.
#
# Lifecycle:
#   1. Player X deploys the contract with their bet amount.
#   2. Player O calls join() to enter the game, adding their bet.
#   3. Players alternate calling move() (non-terminal) or
#      move_and_win() / move_and_tie() (terminal).
#   4. Either player can propose cancel() (requires both signatures).

class TicTacToe < Runar::StatefulSmartContract
  prop :player_x,      PubKey,     readonly: true
  prop :bet_amount,    Bigint,     readonly: true
  prop :p2pkh_prefix,  ByteString, readonly: true, default: '1976a914'
  prop :p2pkh_suffix,  ByteString, readonly: true, default: '88ac'

  prop :player_o, PubKey,  default: '00' * 33
  prop :c0,       Bigint,  default: 0
  prop :c1,       Bigint,  default: 0
  prop :c2,       Bigint,  default: 0
  prop :c3,       Bigint,  default: 0
  prop :c4,       Bigint,  default: 0
  prop :c5,       Bigint,  default: 0
  prop :c6,       Bigint,  default: 0
  prop :c7,       Bigint,  default: 0
  prop :c8,       Bigint,  default: 0
  prop :turn,     Bigint,  default: 0
  prop :status,   Bigint,  default: 0

  def initialize(player_x, bet_amount)
    super(player_x, bet_amount)
    @player_x   = player_x
    @bet_amount = bet_amount
  end

  # Player O joins the game.
  # State-mutating: produces continuation UTXO with doubled bet.
  runar_public opponent_pk: PubKey, sig: Sig
  def join(opponent_pk, sig)
    assert @status == 0
    assert check_sig(sig, opponent_pk)
    @player_o = opponent_pk
    @status   = 1
    @turn     = 1
  end

  # Make a non-terminal move. Updates board and flips turn.
  # State-mutating: produces continuation UTXO.
  runar_public position: Bigint, player: PubKey, sig: Sig
  def move(position, player, sig)
    assert @status == 1
    assert check_sig(sig, player)
    assert_correct_player(player)
    place_move(position)
    if @turn == 1
      @turn = 2
    else
      @turn = 1
    end
  end

  # Make a winning move. Non-mutating terminal method.
  # Enforces winner-gets-all payout via extract_output_hash.
  runar_public position: Bigint, player: PubKey, sig: Sig, change_pkh: ByteString, change_amount: Bigint
  def move_and_win(position, player, sig, change_pkh, change_amount)
    assert @status == 1
    assert check_sig(sig, player)
    assert_correct_player(player)
    assert_cell_empty(position)
    assert check_win_after_move(position, @turn)

    total_payout = @bet_amount * 2
    payout = cat(cat(num2bin(total_payout, 8), @p2pkh_prefix), cat(hash160(player), @p2pkh_suffix))
    if change_amount > 0
      change = cat(cat(num2bin(change_amount, 8), @p2pkh_prefix), cat(change_pkh, @p2pkh_suffix))
      assert hash256(cat(payout, change)) == extract_output_hash(@tx_preimage)
    else
      assert hash256(payout) == extract_output_hash(@tx_preimage)
    end
  end

  # Make a move that fills the board (tie). Non-mutating terminal method.
  # Enforces equal split payout via extract_output_hash.
  runar_public position: Bigint, player: PubKey, sig: Sig, change_pkh: ByteString, change_amount: Bigint
  def move_and_tie(position, player, sig, change_pkh, change_amount)
    assert @status == 1
    assert check_sig(sig, player)
    assert_correct_player(player)
    assert_cell_empty(position)
    assert count_occupied == 8
    assert !check_win_after_move(position, @turn)

    out1 = cat(cat(num2bin(@bet_amount, 8), @p2pkh_prefix), cat(hash160(@player_x), @p2pkh_suffix))
    out2 = cat(cat(num2bin(@bet_amount, 8), @p2pkh_prefix), cat(hash160(@player_o), @p2pkh_suffix))
    if change_amount > 0
      change = cat(cat(num2bin(change_amount, 8), @p2pkh_prefix), cat(change_pkh, @p2pkh_suffix))
      assert hash256(cat(cat(out1, out2), change)) == extract_output_hash(@tx_preimage)
    else
      assert hash256(cat(out1, out2)) == extract_output_hash(@tx_preimage)
    end
  end

  # Player X cancels before anyone joins. Non-mutating terminal method.
  # Refunds the full bet to player X.
  runar_public sig: Sig, change_pkh: ByteString, change_amount: Bigint
  def cancel_before_join(sig, change_pkh, change_amount)
    assert @status == 0
    assert check_sig(sig, @player_x)
    payout = cat(cat(num2bin(@bet_amount, 8), @p2pkh_prefix), cat(hash160(@player_x), @p2pkh_suffix))
    if change_amount > 0
      change = cat(cat(num2bin(change_amount, 8), @p2pkh_prefix), cat(change_pkh, @p2pkh_suffix))
      assert hash256(cat(payout, change)) == extract_output_hash(@tx_preimage)
    else
      assert hash256(payout) == extract_output_hash(@tx_preimage)
    end
  end

  # Both players agree to cancel. Non-mutating terminal method.
  # Enforces equal refund via extract_output_hash.
  runar_public sig_x: Sig, sig_o: Sig, change_pkh: ByteString, change_amount: Bigint
  def cancel(sig_x, sig_o, change_pkh, change_amount)
    out1 = cat(cat(num2bin(@bet_amount, 8), @p2pkh_prefix), cat(hash160(@player_x), @p2pkh_suffix))
    out2 = cat(cat(num2bin(@bet_amount, 8), @p2pkh_prefix), cat(hash160(@player_o), @p2pkh_suffix))
    if change_amount > 0
      change = cat(cat(num2bin(change_amount, 8), @p2pkh_prefix), cat(change_pkh, @p2pkh_suffix))
      assert hash256(cat(cat(out1, out2), change)) == extract_output_hash(@tx_preimage)
    else
      assert hash256(cat(out1, out2)) == extract_output_hash(@tx_preimage)
    end
    assert check_sig(sig_x, @player_x)
    assert check_sig(sig_o, @player_o)
  end

  # --- Private helpers ---

  # Assert the provided player pubkey matches whoever's turn it is.
  def assert_correct_player(player)
    if @turn == 1
      assert player == @player_x
    else
      assert player == @player_o
    end
  end

  # Assert the cell at the given position is empty.
  def assert_cell_empty(position)
    if position == 0
      assert @c0 == 0
    elsif position == 1
      assert @c1 == 0
    elsif position == 2
      assert @c2 == 0
    elsif position == 3
      assert @c3 == 0
    elsif position == 4
      assert @c4 == 0
    elsif position == 5
      assert @c5 == 0
    elsif position == 6
      assert @c6 == 0
    elsif position == 7
      assert @c7 == 0
    elsif position == 8
      assert @c8 == 0
    else
      assert false
    end
  end

  # Place the current turn's mark at the given position.
  def place_move(position)
    assert_cell_empty(position)
    if position == 0
      @c0 = @turn
    elsif position == 1
      @c1 = @turn
    elsif position == 2
      @c2 = @turn
    elsif position == 3
      @c3 = @turn
    elsif position == 4
      @c4 = @turn
    elsif position == 5
      @c5 = @turn
    elsif position == 6
      @c6 = @turn
    elsif position == 7
      @c7 = @turn
    elsif position == 8
      @c8 = @turn
    else
      assert false
    end
  end

  # Get cell value, overriding the specified position with override_val.
  def get_cell_or_override(cell_index, override_pos, override_val)
    if cell_index == override_pos
      return override_val
    end

    if cell_index == 0
      @c0
    elsif cell_index == 1
      @c1
    elsif cell_index == 2
      @c2
    elsif cell_index == 3
      @c3
    elsif cell_index == 4
      @c4
    elsif cell_index == 5
      @c5
    elsif cell_index == 6
      @c6
    elsif cell_index == 7
      @c7
    else
      @c8
    end
  end

  # Check if placing player's mark at position would create a winning line.
  def check_win_after_move(position, player)
    v0 = get_cell_or_override(0, position, player)
    v1 = get_cell_or_override(1, position, player)
    v2 = get_cell_or_override(2, position, player)
    v3 = get_cell_or_override(3, position, player)
    v4 = get_cell_or_override(4, position, player)
    v5 = get_cell_or_override(5, position, player)
    v6 = get_cell_or_override(6, position, player)
    v7 = get_cell_or_override(7, position, player)
    v8 = get_cell_or_override(8, position, player)

    if v0 == player && v1 == player && v2 == player
      return true
    end
    if v3 == player && v4 == player && v5 == player
      return true
    end
    if v6 == player && v7 == player && v8 == player
      return true
    end
    if v0 == player && v3 == player && v6 == player
      return true
    end
    if v1 == player && v4 == player && v7 == player
      return true
    end
    if v2 == player && v5 == player && v8 == player
      return true
    end
    if v0 == player && v4 == player && v8 == player
      return true
    end
    if v2 == player && v4 == player && v6 == player
      return true
    end

    false
  end

  # Count the number of occupied cells on the board.
  def count_occupied
    count = 0
    if @c0 != 0
      count += 1
    end
    if @c1 != 0
      count += 1
    end
    if @c2 != 0
      count += 1
    end
    if @c3 != 0
      count += 1
    end
    if @c4 != 0
      count += 1
    end
    if @c5 != 0
      count += 1
    end
    if @c6 != 0
      count += 1
    end
    if @c7 != 0
      count += 1
    end
    if @c8 != 0
      count += 1
    end
    count
  end
end
`,
    constructorArgs: {
      playerX: ALICE.pubKey,
      betAmount: 10000n,
    },
    methodCall: {
      method: 'join',
      args: [
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'Sig', signer: 'bob' },
      ],
    },
    description: 'On-chain Tic-Tac-Toe game. Two players bet and compete, rules enforced by Bitcoin Script.',
  },
  {
    id: 'token-ft',
    name: 'Fungible Token',
    language: 'typescript',
    source: `import { StatefulSmartContract, assert, checkSig, hash256, substr, extractHashPrevouts, extractOutpoint } from 'runar-lang';
import type { PubKey, Sig, ByteString } from 'runar-lang';

/**
 * FungibleToken -- A UTXO-based fungible token using Runar's multi-output (\`addOutput\`) facility.
 *
 * Demonstrates how to model divisible token balances that can be split, transferred, and
 * merged -- similar to colored coins or SLP-style tokens but enforced entirely by Bitcoin Script.
 *
 * **UTXO token model vs account model:**
 * Unlike Ethereum ERC-20 where balances live in a global mapping, each token "balance" here
 * is a separate UTXO. The UTXO carries state: the current owner (PubKey), balance (bigint),
 * and an immutable tokenId (ByteString). Transferring tokens means spending one UTXO and
 * creating new ones with updated state.
 *
 * **Operations:**
 * - \`transfer\` -- Split: 1 UTXO -> 2 UTXOs (recipient + change back to sender)
 * - \`send\`     -- Simple send: 1 UTXO -> 1 UTXO (full balance to new owner)
 * - \`merge\`    -- Secure merge: 2 UTXOs -> 1 UTXO (consolidate two token UTXOs)
 *
 * **Secure merge design:**
 * The merge uses position-dependent output construction verified via \`hashPrevouts\`.
 * Each input reads its own balance from its locking script (verified by OP_PUSH_TX)
 * and writes it to a specific slot in the output based on its position in the transaction.
 * Since \`hashOutputs\` forces both inputs to agree on the exact same output, each input's
 * claimed \`otherBalance\` must equal the other input's real verified balance.
 * This prevents the inflation attack where an attacker lies about \`otherBalance\`.
 *
 * The output stores both individual balances (\`balance\` and \`mergeBalance\`) so they can
 * be independently verified. Subsequent operations use the sum as the available balance.
 *
 * **Authorization:** All operations require the current owner's ECDSA signature via \`checkSig\`.
 */
class FungibleToken extends StatefulSmartContract {
  /** Current owner's public key. Mutable -- updated when tokens are sent to a new owner. */
  owner: PubKey;
  /** Primary token balance. Mutable -- adjusted on transfer/split/merge. */
  balance: bigint;
  /** Secondary balance slot used during merge for cross-input verification. Normally 0. */
  mergeBalance: bigint;
  /**
   * Unique token identifier. Readonly -- baked into the locking script at deploy time
   * and cannot change, ensuring token identity is preserved across all transfers.
   */
  readonly tokenId: ByteString;

  constructor(owner: PubKey, balance: bigint, mergeBalance: bigint, tokenId: ByteString) {
    super(owner, balance, mergeBalance, tokenId);
    this.owner = owner;
    this.balance = balance;
    this.mergeBalance = mergeBalance;
    this.tokenId = tokenId;
  }

  /**
   * Transfer tokens to a recipient. If the full balance is sent, produces 1 output;
   * otherwise produces 2 outputs (recipient + change back to sender).
   */
  public transfer(sig: Sig, to: PubKey, amount: bigint, outputSatoshis: bigint) {
    assert(checkSig(sig, this.owner));
    assert(outputSatoshis >= 1n);
    const totalBalance = this.balance + this.mergeBalance;
    assert(amount > 0n);
    assert(amount <= totalBalance);

    this.addOutput(outputSatoshis, to, amount, 0n);
    if (amount < totalBalance) {
      this.addOutput(outputSatoshis, this.owner, totalBalance - amount, 0n);
    }
  }

  /**
   * Simple send: 1 UTXO -> 1 UTXO. Transfers the entire balance to a new owner.
   */
  public send(sig: Sig, to: PubKey, outputSatoshis: bigint) {
    assert(checkSig(sig, this.owner));
    assert(outputSatoshis >= 1n);

    this.addOutput(outputSatoshis, to, this.balance + this.mergeBalance, 0n);
  }

  /**
   * Secure merge: 2 UTXOs -> 1 UTXO. Consolidates two token UTXOs.
   *
   * **Why this is secure (anti-inflation proof):**
   *
   * Each input reads its own balance from its locking script (\`this.balance\`), which is
   * verified by OP_PUSH_TX — it cannot be faked. Each input writes its verified balance
   * to a specific output slot based on its position in the transaction.
   *
   * Position is derived from \`allPrevouts\` (verified against \`hashPrevouts\` in the
   * preimage, so it reflects the real transaction) and the input's own outpoint.
   *
   * The output has two balance slots: \`balance\` (slot 0) and \`mergeBalance\` (slot 1).
   * Each input places its own verified balance in its slot, and the claimed \`otherBalance\`
   * in the other slot:
   *
   *   Input 0 (balance=400): addOutput(sats, owner, 400, otherBalance₀)
   *   Input 1 (balance=600): addOutput(sats, owner, otherBalance₁, 600)
   *
   * Both inputs must produce byte-identical outputs (enforced by \`hashOutputs\` in BIP-143).
   * This forces:
   *   - slot 0: 400 == otherBalance₁  →  input 1 MUST pass 400
   *   - slot 1: otherBalance₀ == 600  →  input 0 MUST pass 600
   *
   * Any lie causes a \`hashOutputs\` mismatch and the transaction is rejected on-chain.
   * The inputs can be in any order — each self-discovers its position from the preimage.
   *
   * @param sig            - Current owner's signature
   * @param otherBalance   - Claimed balance of the other merging input
   * @param allPrevouts    - Concatenated outpoints of all tx inputs (verified via hashPrevouts)
   * @param outputSatoshis - Satoshis to fund the merged output
   */
  public merge(sig: Sig, otherBalance: bigint, allPrevouts: ByteString, outputSatoshis: bigint) {
    assert(checkSig(sig, this.owner));
    assert(outputSatoshis >= 1n);
    assert(otherBalance >= 0n);

    // Verify allPrevouts is authentic (matches the actual transaction inputs)
    assert(hash256(allPrevouts) === extractHashPrevouts(this.txPreimage));

    // Determine position: am I the first contract input?
    const myOutpoint = extractOutpoint(this.txPreimage);
    const firstOutpoint = substr(allPrevouts, 0n, 36n);
    const myBalance = this.balance + this.mergeBalance;

    if (myOutpoint === firstOutpoint) {
      // I'm input 0: my verified balance goes to slot 0
      this.addOutput(outputSatoshis, this.owner, myBalance, otherBalance);
    } else {
      // I'm input 1: my verified balance goes to slot 1
      this.addOutput(outputSatoshis, this.owner, otherBalance, myBalance);
    }
  }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
      mergeBalance: 0n,
      tokenId: 'deadbeef',
    },
    methodCall: {
      method: 'send',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'UTXO-based fungible token with transfer, send, and secure merge operations.',
  },
  {
    id: 'sol-token-ft',
    name: 'Fungible Token (Solidity)',
    language: 'solidity',
    source: ` pragma runar ^0.1.0;

/// @title FungibleToken
/// @notice A UTXO-based fungible token using Runar's multi-output (addOutput) facility.
/// Demonstrates how to model divisible token balances that can be split, transferred, and
/// merged -- similar to colored coins or SLP-style tokens but enforced entirely by Bitcoin Script.
/// @dev UTXO token model vs account model:
/// Unlike Ethereum ERC-20 where balances live in a global mapping, each token "balance" here
/// is a separate UTXO. The UTXO carries state: the current owner (PubKey), balance (bigint),
/// mergeBalance (bigint), and an immutable tokenId (ByteString). Transferring tokens means
/// spending one UTXO and creating new ones with updated state.
///
/// Operations:
///   transfer -- Split: 1 UTXO -> 2 UTXOs (recipient + change back to sender)
///   send     -- Simple send: 1 UTXO -> 1 UTXO (full balance to new owner)
///   merge    -- Secure merge: 2 UTXOs -> 1 UTXO (consolidate two token UTXOs)
///
/// Secure merge design:
/// The merge uses position-dependent output construction verified via hashPrevouts.
/// Each input reads its own balance from its locking script (verified by OP_PUSH_TX)
/// and writes it to a specific slot in the output based on its position in the transaction.
/// Since hashOutputs forces both inputs to agree on the exact same output, each input's
/// claimed otherBalance must equal the other input's real verified balance.
/// This prevents the inflation attack where an attacker lies about otherBalance.
///
/// The output stores both individual balances (balance and mergeBalance) so they can
/// be independently verified. Subsequent operations use the sum as the available balance.
///
/// Authorization: All operations require the current owner's ECDSA signature via checkSig.
contract FungibleToken is StatefulSmartContract {
    PubKey owner;                    /// @notice Current owner's public key. Mutable -- updated on ownership transfer.
    bigint balance;                  /// @notice Primary token balance. Mutable -- adjusted on transfer/split/merge.
    bigint mergeBalance;             /// @notice Secondary balance slot used during merge for cross-input verification. Normally 0.
    ByteString immutable tokenId;    /// @notice Unique token identifier. Readonly -- baked into the locking script, cannot change.

    constructor(PubKey _owner, bigint _balance, bigint _mergeBalance, ByteString _tokenId) {
        owner = _owner;
        balance = _balance;
        mergeBalance = _mergeBalance;
        tokenId = _tokenId;
    }

    /// @notice Transfer tokens to a recipient. If the full balance is sent, produces 1 output;
    /// otherwise produces 2 outputs (recipient + change back to sender).
    /// @dev Uses addOutput to create continuation UTXOs in the spending transaction.
    /// addOutput(satoshis, ...stateValues) takes positional state values matching mutable
    /// properties in declaration order: owner, balance, mergeBalance.
    /// @param sig Current owner's signature (authorization)
    /// @param to Recipient's public key
    /// @param amount Number of tokens to send (must be > 0 and <= total available balance)
    /// @param outputSatoshis Satoshis to fund each output UTXO
    function transfer(Sig sig, PubKey to, bigint amount, bigint outputSatoshis) public {
        require(checkSig(sig, this.owner));
        require(outputSatoshis >= 1);
        bigint totalBalance = this.balance + this.mergeBalance;
        require(amount > 0);
        require(amount <= totalBalance);

        // First output: recipient receives \`amount\` tokens
        this.addOutput(outputSatoshis, to, amount, 0);
        // Second output: sender keeps the remaining balance as change (skip if fully spent)
        if (amount < totalBalance) {
            this.addOutput(outputSatoshis, this.owner, totalBalance - amount, 0);
        }
    }

    /// @notice Simple send: 1 UTXO -> 1 UTXO. Transfers the entire balance to a new owner.
    /// @dev Creates a single continuation UTXO with the same balance but a new owner.
    /// @param sig Current owner's signature (authorization)
    /// @param to New owner's public key
    /// @param outputSatoshis Satoshis to fund the output UTXO
    function send(Sig sig, PubKey to, bigint outputSatoshis) public {
        require(checkSig(sig, this.owner));
        require(outputSatoshis >= 1);

        this.addOutput(outputSatoshis, to, this.balance + this.mergeBalance, 0);
    }

    /// @notice Secure merge: 2 UTXOs -> 1 UTXO. Consolidates two token UTXOs.
    ///
    /// @dev Why this is secure (anti-inflation proof):
    ///
    /// Each input reads its own balance from its locking script (this.balance), which is
    /// verified by OP_PUSH_TX — it cannot be faked. Each input writes its verified balance
    /// to a specific output slot based on its position in the transaction.
    ///
    /// Position is derived from allPrevouts (verified against hashPrevouts in the
    /// preimage, so it reflects the real transaction) and the input's own outpoint.
    ///
    /// The output has two balance slots: balance (slot 0) and mergeBalance (slot 1).
    /// Each input places its own verified balance in its slot, and the claimed otherBalance
    /// in the other slot:
    ///
    ///   Input 0 (balance=400): addOutput(sats, owner, 400, otherBalance_0)
    ///   Input 1 (balance=600): addOutput(sats, owner, otherBalance_1, 600)
    ///
    /// Both inputs must produce byte-identical outputs (enforced by hashOutputs in BIP-143).
    /// This forces:
    ///   - slot 0: 400 == otherBalance_1  ->  input 1 MUST pass 400
    ///   - slot 1: otherBalance_0 == 600  ->  input 0 MUST pass 600
    ///
    /// Any lie causes a hashOutputs mismatch and the transaction is rejected on-chain.
    /// The inputs can be in any order — each self-discovers its position from the preimage.
    ///
    /// @param sig Current owner's signature (authorization)
    /// @param otherBalance Claimed balance of the other merging input
    /// @param allPrevouts Concatenated outpoints of all tx inputs (verified via hashPrevouts)
    /// @param outputSatoshis Satoshis to fund the merged output UTXO
    function merge(Sig sig, bigint otherBalance, ByteString allPrevouts, bigint outputSatoshis) public {
        require(checkSig(sig, this.owner));
        require(outputSatoshis >= 1);
        require(otherBalance >= 0);

        // Verify allPrevouts is authentic (matches the actual transaction inputs)
        require(hash256(allPrevouts) == extractHashPrevouts(this.txPreimage));

        // Determine position: am I the first contract input?
        ByteString myOutpoint = extractOutpoint(this.txPreimage);
        ByteString firstOutpoint = substr(allPrevouts, 0, 36);
        bigint myBalance = this.balance + this.mergeBalance;

        if (myOutpoint == firstOutpoint) {
            // I'm input 0: my verified balance goes to slot 0
            this.addOutput(outputSatoshis, this.owner, myBalance, otherBalance);
        } else {
            // I'm input 1: my verified balance goes to slot 1
            this.addOutput(outputSatoshis, this.owner, otherBalance, myBalance);
        }
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
      mergeBalance: 0n,
      tokenId: 'deadbeef',
    },
    methodCall: {
      method: 'send',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'UTXO-based fungible token with transfer, send, and secure merge operations.',
  },
  {
    id: 'move-token-ft',
    name: 'Fungible Token (Move)',
    language: 'move',
    source: `// FungibleToken -- A UTXO-based fungible token using Runar's multi-output (add_output) facility.
//
// Demonstrates how to model divisible token balances that can be split, transferred, and
// merged -- similar to colored coins or SLP-style tokens but enforced entirely by Bitcoin Script.
//
// UTXO token model vs account model:
// Unlike Ethereum ERC-20 where balances live in a global mapping, each token "balance" here
// is a separate UTXO. The UTXO carries state: the current owner (PubKey), balance (bigint),
// merge_balance (bigint), and an immutable token_id (ByteString). Transferring tokens means
// spending one UTXO and creating new ones with updated state.
//
// Operations:
//   transfer -- Split: 1 UTXO -> 2 UTXOs (recipient + change back to sender)
//   send     -- Simple send: 1 UTXO -> 1 UTXO (full balance to new owner)
//   merge    -- Secure merge: 2 UTXOs -> 1 UTXO (consolidate two token UTXOs)
//
// Secure merge design:
// The merge uses position-dependent output construction verified via hash_prevouts.
// Each input reads its own balance from its locking script (verified by OP_PUSH_TX)
// and writes it to a specific slot in the output based on its position in the transaction.
// Since hash_outputs forces both inputs to agree on the exact same output, each input's
// claimed other_balance must equal the other input's real verified balance.
// This prevents the inflation attack where an attacker lies about other_balance.
//
// The output stores both individual balances (balance and merge_balance) so they can
// be independently verified. Subsequent operations use the sum as the available balance.
//
// Authorization: All operations require the current owner's ECDSA signature via check_sig.
module FungibleToken {
    use runar::types::{PubKey, Sig, ByteString};
    use runar::crypto::{check_sig, hash256, extract_hash_prevouts, extract_outpoint, substr};

    resource struct FungibleToken {
        owner: &mut PubKey,           // Current owner's public key. Mutable -- updated on ownership transfer.
        balance: &mut bigint,         // Primary token balance. Mutable -- adjusted on transfer/split/merge.
        merge_balance: &mut bigint,   // Secondary balance slot used during merge for cross-input verification. Normally 0.
        token_id: ByteString,         // Unique token identifier. Immutable -- baked into the locking script, cannot change.
    }

    // Transfer tokens to a recipient. If the full balance is sent, produces 1 output;
    // otherwise produces 2 outputs (recipient + change back to sender).
    //
    // Uses add_output to create continuation UTXOs in the spending transaction.
    // add_output(satoshis, ...state_values) takes positional state values matching mutable
    // properties in declaration order: owner, balance, merge_balance.
    //
    // Parameters:
    //   sig: current owner's signature (authorization)
    //   to: recipient's public key
    //   amount: number of tokens to send (must be > 0 and <= total available balance)
    //   output_satoshis: satoshis to fund each output UTXO
    public fun transfer(contract: &mut FungibleToken, sig: Sig, to: PubKey, amount: bigint, output_satoshis: bigint) {
        assert!(check_sig(sig, contract.owner), 0);
        assert!(output_satoshis >= 1, 0);
        let total_balance: bigint = contract.balance + contract.merge_balance;
        assert!(amount > 0, 0);
        assert!(amount <= total_balance, 0);

        // First output: recipient receives \`amount\` tokens
        contract.add_output(output_satoshis, to, amount, 0);
        // Second output: sender keeps the remaining balance as change (skip if fully spent)
        if (amount < total_balance) {
            contract.add_output(output_satoshis, contract.owner, total_balance - amount, 0);
        }
    }

    // Simple send: 1 UTXO -> 1 UTXO. Transfers the entire balance to a new owner.
    //
    // Creates a single continuation UTXO with the same balance but a new owner.
    //
    // Parameters:
    //   sig: current owner's signature (authorization)
    //   to: new owner's public key
    //   output_satoshis: satoshis to fund the output UTXO
    public fun send(contract: &mut FungibleToken, sig: Sig, to: PubKey, output_satoshis: bigint) {
        assert!(check_sig(sig, contract.owner), 0);
        assert!(output_satoshis >= 1, 0);

        contract.add_output(output_satoshis, to, contract.balance + contract.merge_balance, 0);
    }

    // Secure merge: 2 UTXOs -> 1 UTXO. Consolidates two token UTXOs.
    //
    // Why this is secure (anti-inflation proof):
    //
    // Each input reads its own balance from its locking script (contract.balance), which is
    // verified by OP_PUSH_TX — it cannot be faked. Each input writes its verified balance
    // to a specific output slot based on its position in the transaction.
    //
    // Position is derived from all_prevouts (verified against hash_prevouts in the
    // preimage, so it reflects the real transaction) and the input's own outpoint.
    //
    // The output has two balance slots: balance (slot 0) and merge_balance (slot 1).
    // Each input places its own verified balance in its slot, and the claimed other_balance
    // in the other slot:
    //
    //   Input 0 (balance=400): add_output(sats, owner, 400, other_balance_0)
    //   Input 1 (balance=600): add_output(sats, owner, other_balance_1, 600)
    //
    // Both inputs must produce byte-identical outputs (enforced by hash_outputs in BIP-143).
    // This forces:
    //   - slot 0: 400 == other_balance_1  ->  input 1 MUST pass 400
    //   - slot 1: other_balance_0 == 600  ->  input 0 MUST pass 600
    //
    // Any lie causes a hash_outputs mismatch and the transaction is rejected on-chain.
    // The inputs can be in any order — each self-discovers its position from the preimage.
    //
    // Parameters:
    //   sig: current owner's signature (authorization)
    //   other_balance: claimed balance of the other merging input
    //   all_prevouts: concatenated outpoints of all tx inputs (verified via hash_prevouts)
    //   output_satoshis: satoshis to fund the merged output UTXO
    public fun merge(contract: &mut FungibleToken, sig: Sig, other_balance: bigint, all_prevouts: ByteString, output_satoshis: bigint) {
        assert!(check_sig(sig, contract.owner), 0);
        assert!(output_satoshis >= 1, 0);
        assert!(other_balance >= 0, 0);

        // Verify all_prevouts is authentic (matches the actual transaction inputs)
        assert!(hash256(all_prevouts) == extract_hash_prevouts(contract.tx_preimage), 0);

        // Determine position: am I the first contract input?
        let my_outpoint: ByteString = extract_outpoint(contract.tx_preimage);
        let first_outpoint: ByteString = substr(all_prevouts, 0, 36);
        let my_balance: bigint = contract.balance + contract.merge_balance;

        if (my_outpoint == first_outpoint) {
            // I'm input 0: my verified balance goes to slot 0
            contract.add_output(output_satoshis, contract.owner, my_balance, other_balance);
        } else {
            // I'm input 1: my verified balance goes to slot 1
            contract.add_output(output_satoshis, contract.owner, other_balance, my_balance);
        }
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
      mergeBalance: 0n,
      tokenId: 'deadbeef',
    },
    methodCall: {
      method: 'send',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'UTXO-based fungible token with transfer, send, and secure merge operations.',
  },
  {
    id: 'go-token-ft',
    name: 'Fungible Token (Go)',
    language: 'go',
    source: `package contract

import runar "github.com/icellan/runar/packages/runar-go"

// FungibleToken is a UTXO-based fungible token using Runar's multi-output (AddOutput) facility.
//
// It demonstrates how to model divisible token balances that can be split, transferred, and
// merged -- similar to colored coins or SLP-style tokens but enforced entirely by Bitcoin Script.
//
// UTXO token model vs account model:
// Unlike Ethereum ERC-20 where balances live in a global mapping, each token "balance" here
// is a separate UTXO. The UTXO carries state: the current owner (PubKey), balance (Bigint),
// and an immutable TokenId (ByteString). Transferring tokens means spending one UTXO and
// creating new ones with updated state.
//
// Operations:
//   - Transfer -- Split: 1 UTXO -> 2 UTXOs (recipient + change back to sender)
//   - Send     -- Simple send: 1 UTXO -> 1 UTXO (full balance to new owner)
//   - Merge    -- Secure merge: 2 UTXOs -> 1 UTXO (consolidate two token UTXOs)
//
// Secure merge design:
// The merge uses position-dependent output construction verified via hashPrevouts.
// Each input reads its own balance from its locking script (verified by OP_PUSH_TX)
// and writes it to a specific slot in the output based on its position in the transaction.
// Since hashOutputs forces both inputs to agree on the exact same output, each input's
// claimed otherBalance must equal the other input's real verified balance.
// This prevents the inflation attack where an attacker lies about otherBalance.
//
// The output stores both individual balances (Balance and MergeBalance) so they can
// be independently verified. Subsequent operations use the sum as the available balance.
//
// Authorization: All operations require the current owner's ECDSA signature via CheckSig.
type FungibleToken struct {
	runar.StatefulSmartContract
	Owner        runar.PubKey     // Current owner's public key. Mutable -- updated on ownership transfer.
	Balance      runar.Bigint     // Primary token balance. Mutable -- adjusted on transfer/split/merge.
	MergeBalance runar.Bigint     // Secondary balance slot used during merge for cross-input verification. Normally 0.
	TokenId      runar.ByteString \`runar:"readonly"\` // Unique token identifier. Readonly -- baked into the locking script, cannot change.
}

// Transfer sends tokens to a recipient. If the full balance is sent, produces 1 output;
// otherwise produces 2 outputs (recipient + change back to sender).
//
// Uses AddOutput twice to create two continuation UTXOs in the spending transaction.
// AddOutput(satoshis, ...stateValues) takes positional state values matching mutable
// properties in declaration order: Owner, Balance, MergeBalance.
//
// Parameters:
//   - sig: current owner's signature (authorization)
//   - to: recipient's public key
//   - amount: number of tokens to send (must be > 0 and <= current balance)
//   - outputSatoshis: satoshis to fund each output UTXO
func (c *FungibleToken) Transfer(sig runar.Sig, to runar.PubKey, amount runar.Bigint, outputSatoshis runar.Bigint) {
	runar.Assert(runar.CheckSig(sig, c.Owner))
	runar.Assert(outputSatoshis >= 1)
	totalBalance := c.Balance + c.MergeBalance
	runar.Assert(amount > 0)
	runar.Assert(amount <= totalBalance)

	// First output: recipient receives \`amount\` tokens
	c.AddOutput(outputSatoshis, to, amount, 0)
	// Second output: sender keeps the remaining balance as change (skip if fully spent)
	if amount < totalBalance {
		c.AddOutput(outputSatoshis, c.Owner, totalBalance-amount, 0)
	}
}

// Send transfers the entire balance to a new owner in a single output.
// (1 UTXO -> 1 UTXO)
//
// Creates a single continuation UTXO with the same balance but a new owner.
//
// Parameters:
//   - sig: current owner's signature (authorization)
//   - to: new owner's public key
//   - outputSatoshis: satoshis to fund the output UTXO
func (c *FungibleToken) Send(sig runar.Sig, to runar.PubKey, outputSatoshis runar.Bigint) {
	runar.Assert(runar.CheckSig(sig, c.Owner))
	runar.Assert(outputSatoshis >= 1)

	c.AddOutput(outputSatoshis, to, c.Balance+c.MergeBalance, 0)
}

// Merge securely consolidates two token UTXOs into one.
// (2 UTXOs -> 1 UTXO)
//
// Why this is secure (anti-inflation proof):
//
// Each input reads its own balance from its locking script (c.Balance), which is
// verified by OP_PUSH_TX — it cannot be faked. Each input writes its verified balance
// to a specific output slot based on its position in the transaction.
//
// Position is derived from allPrevouts (verified against hashPrevouts in the
// preimage, so it reflects the real transaction) and the input's own outpoint.
//
// The output has two balance slots: Balance (slot 0) and MergeBalance (slot 1).
// Each input places its own verified balance in its slot, and the claimed otherBalance
// in the other slot:
//
//	Input 0 (balance=400): AddOutput(sats, owner, 400, otherBalance_0)
//	Input 1 (balance=600): AddOutput(sats, owner, otherBalance_1, 600)
//
// Both inputs must produce byte-identical outputs (enforced by hashOutputs in BIP-143).
// This forces:
//   - slot 0: 400 == otherBalance_1  ->  input 1 MUST pass 400
//   - slot 1: otherBalance_0 == 600  ->  input 0 MUST pass 600
//
// Any lie causes a hashOutputs mismatch and the transaction is rejected on-chain.
// The inputs can be in any order — each self-discovers its position from the preimage.
//
// Parameters:
//   - sig: current owner's signature (authorization)
//   - otherBalance: claimed balance of the other merging input
//   - allPrevouts: concatenated outpoints of all tx inputs (verified via hashPrevouts)
//   - outputSatoshis: satoshis to fund the merged output UTXO
func (c *FungibleToken) Merge(sig runar.Sig, otherBalance runar.Bigint, allPrevouts runar.ByteString, outputSatoshis runar.Bigint) {
	runar.Assert(runar.CheckSig(sig, c.Owner))
	runar.Assert(outputSatoshis >= 1)
	runar.Assert(otherBalance >= 0)

	// Verify allPrevouts is authentic (matches the actual transaction inputs)
	runar.Assert(runar.Hash256(allPrevouts) == runar.ExtractHashPrevouts(c.TxPreimage))

	// Determine position: am I the first contract input?
	myOutpoint := runar.ExtractOutpoint(c.TxPreimage)
	firstOutpoint := runar.Substr(allPrevouts, 0, 36)
	myBalance := c.Balance + c.MergeBalance

	if myOutpoint == firstOutpoint {
		// I'm input 0: my verified balance goes to slot 0
		c.AddOutput(outputSatoshis, c.Owner, myBalance, otherBalance)
	} else {
		// I'm input 1: my verified balance goes to slot 1
		c.AddOutput(outputSatoshis, c.Owner, otherBalance, myBalance)
	}
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
      mergeBalance: 0n,
      tokenId: 'deadbeef',
    },
    methodCall: {
      method: 'send',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'UTXO-based fungible token with transfer, send, and secure merge operations.',
  },
  {
    id: 'rust-token-ft',
    name: 'Fungible Token (Rust)',
    language: 'rust',
    source: `use runar::prelude::*;

/// A UTXO-based fungible token using Runar's multi-output (\`add_output\`) facility.
///
/// Demonstrates how to model divisible token balances that can be split, transferred, and
/// merged -- similar to colored coins or SLP-style tokens but enforced entirely by Bitcoin Script.
///
/// # UTXO token model vs account model
///
/// Unlike Ethereum ERC-20 where balances live in a global mapping, each token "balance" here
/// is a separate UTXO. The UTXO carries state: the current owner (\`PubKey\`), balance (\`Bigint\`),
/// and an immutable \`token_id\` (\`ByteString\`). Transferring tokens means spending one UTXO and
/// creating new ones with updated state.
///
/// # Operations
///
/// - \`transfer\` -- Split: 1 UTXO -> 2 UTXOs (recipient + change back to sender)
/// - \`send\`     -- Simple send: 1 UTXO -> 1 UTXO (full balance to new owner)
/// - \`merge\`    -- Secure merge: 2 UTXOs -> 1 UTXO (consolidate two token UTXOs)
///
/// # Secure merge design
///
/// The merge uses position-dependent output construction verified via \`hash_prevouts\`.
/// Each input reads its own balance from its locking script (verified by OP_PUSH_TX)
/// and writes it to a specific slot in the output based on its position in the transaction.
/// Since \`hash_outputs\` forces both inputs to agree on the exact same output, each input's
/// claimed \`other_balance\` must equal the other input's real verified balance.
/// This prevents the inflation attack where an attacker lies about \`other_balance\`.
///
/// The output stores both individual balances (\`balance\` and \`merge_balance\`) so they can
/// be independently verified. Subsequent operations use the sum as the available balance.
///
/// # Authorization
///
/// All operations require the current owner's ECDSA signature via \`check_sig\`.
#[runar::contract]
pub struct FungibleToken {
    /// Current owner's public key. Mutable -- updated when tokens are sent to a new owner.
    pub owner: PubKey,
    /// Primary token balance. Mutable -- adjusted on transfer/split/merge.
    pub balance: Bigint,
    /// Secondary balance slot used during merge for cross-input verification. Normally 0.
    pub merge_balance: Bigint,
    /// Unique token identifier. Readonly -- baked into the locking script at deploy time
    /// and cannot change, ensuring token identity is preserved across all transfers.
    #[readonly]
    pub token_id: ByteString,
    /// Sighash preimage injected by the compiler for \`checkPreimage\` verification.
    pub tx_preimage: SigHashPreimage,
}

#[runar::methods(FungibleToken)]
impl FungibleToken {
    /// Transfer tokens to a recipient. If the full balance is sent, produces 1 output;
    /// otherwise produces 2 outputs (recipient + change back to sender).
    ///
    /// Uses \`add_output\` to create continuation UTXOs in the spending transaction.
    /// \`add_output(satoshis, ...state_values)\` takes positional state values matching mutable
    /// properties in declaration order: owner, balance, merge_balance.
    ///
    /// # Parameters
    /// - \`sig\` - Current owner's signature (authorization)
    /// - \`to\` - Recipient's public key
    /// - \`amount\` - Number of tokens to send (must be > 0 and <= total available balance)
    /// - \`output_satoshis\` - Satoshis to fund each output UTXO
    #[public]
    pub fn transfer(&mut self, sig: &Sig, to: PubKey, amount: Bigint, output_satoshis: Bigint) {
        assert!(check_sig(sig, &self.owner));
        assert!(output_satoshis >= 1);
        let total_balance = self.balance + self.merge_balance;
        assert!(amount > 0);
        assert!(amount <= total_balance);

        // First output: recipient receives \`amount\` tokens
        self.add_output(output_satoshis, to, amount, 0);
        // Second output: sender keeps the remaining balance as change (skip if fully spent)
        if amount < total_balance {
            let change_owner = self.owner.clone();
            let change_balance = total_balance - amount;
            self.add_output(output_satoshis, change_owner, change_balance, 0);
        }
    }

    /// Simple send: 1 UTXO -> 1 UTXO. Transfers the entire balance to a new owner.
    ///
    /// Creates a single continuation UTXO with the same balance but a new owner.
    ///
    /// # Parameters
    /// - \`sig\` - Current owner's signature (authorization)
    /// - \`to\` - New owner's public key
    /// - \`output_satoshis\` - Satoshis to fund the output UTXO
    #[public]
    pub fn send(&mut self, sig: &Sig, to: PubKey, output_satoshis: Bigint) {
        assert!(check_sig(sig, &self.owner));
        assert!(output_satoshis >= 1);
        self.add_output(output_satoshis, to, self.balance + self.merge_balance, 0);
    }

    /// Secure merge: 2 UTXOs -> 1 UTXO. Consolidates two token UTXOs.
    ///
    /// # Why this is secure (anti-inflation proof)
    ///
    /// Each input reads its own balance from its locking script (\`self.balance\`), which is
    /// verified by OP_PUSH_TX — it cannot be faked. Each input writes its verified balance
    /// to a specific output slot based on its position in the transaction.
    ///
    /// Position is derived from \`all_prevouts\` (verified against \`hash_prevouts\` in the
    /// preimage, so it reflects the real transaction) and the input's own outpoint.
    ///
    /// The output has two balance slots: \`balance\` (slot 0) and \`merge_balance\` (slot 1).
    /// Each input places its own verified balance in its slot, and the claimed \`other_balance\`
    /// in the other slot:
    ///
    /// \`\`\`text
    ///   Input 0 (balance=400): add_output(sats, owner, 400, other_balance_0)
    ///   Input 1 (balance=600): add_output(sats, owner, other_balance_1, 600)
    /// \`\`\`
    ///
    /// Both inputs must produce byte-identical outputs (enforced by \`hash_outputs\` in BIP-143).
    /// This forces:
    ///   - slot 0: 400 == other_balance_1  →  input 1 MUST pass 400
    ///   - slot 1: other_balance_0 == 600  →  input 0 MUST pass 600
    ///
    /// Any lie causes a \`hash_outputs\` mismatch and the transaction is rejected on-chain.
    /// The inputs can be in any order — each self-discovers its position from the preimage.
    ///
    /// # Parameters
    /// - \`sig\` - Current owner's signature (authorization)
    /// - \`other_balance\` - Claimed balance of the other merging input
    /// - \`all_prevouts\` - Concatenated outpoints of all tx inputs (verified via hash_prevouts)
    /// - \`output_satoshis\` - Satoshis to fund the merged output UTXO
    #[public]
    pub fn merge(&mut self, sig: &Sig, other_balance: Bigint, all_prevouts: ByteString, output_satoshis: Bigint) {
        assert!(check_sig(sig, &self.owner));
        assert!(output_satoshis >= 1);
        assert!(other_balance >= 0);

        // Verify all_prevouts is authentic (matches the actual transaction inputs)
        assert!(hash256(&all_prevouts) == extract_hash_prevouts(&self.tx_preimage));

        // Determine position: am I the first contract input?
        let my_outpoint = extract_outpoint(&self.tx_preimage);
        let first_outpoint = substr(&all_prevouts, 0, 36);
        let my_balance = self.balance + self.merge_balance;
        let owner = self.owner.clone();

        if my_outpoint == first_outpoint {
            // I'm input 0: my verified balance goes to slot 0
            self.add_output(output_satoshis, owner, my_balance, other_balance);
        } else {
            // I'm input 1: my verified balance goes to slot 1
            self.add_output(output_satoshis, owner, other_balance, my_balance);
        }
    }
}
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
      mergeBalance: 0n,
      tokenId: 'deadbeef',
    },
    methodCall: {
      method: 'send',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'UTXO-based fungible token with transfer, send, and secure merge operations.',
  },
  {
    id: 'python-token-ft',
    name: 'Fungible Token (Python)',
    language: 'python',
    source: `from runar import (
    StatefulSmartContract, PubKey, Sig, ByteString, Bigint, Readonly,
    public, assert_, check_sig, hash256, substr, extract_hash_prevouts, extract_outpoint,
)


class FungibleToken(StatefulSmartContract):
    """A UTXO-based fungible token using Runar's multi-output (add_output) facility.

    Demonstrates how to model divisible token balances that can be split, transferred, and
    merged -- similar to colored coins or SLP-style tokens but enforced entirely by Bitcoin Script.

    UTXO token model vs account model:
        Unlike Ethereum ERC-20 where balances live in a global mapping, each token "balance"
        here is a separate UTXO. The UTXO carries state: the current owner (PubKey), balance
        (Bigint), and an immutable token_id (ByteString). Transferring tokens means spending
        one UTXO and creating new ones with updated state.

    Operations:
        transfer -- Split: 1 UTXO -> 2 UTXOs (recipient + change back to sender)
        send     -- Simple send: 1 UTXO -> 1 UTXO (full balance to new owner)
        merge    -- Secure merge: 2 UTXOs -> 1 UTXO (consolidate two token UTXOs)

    Secure merge design:
        The merge uses position-dependent output construction verified via hash_prevouts.
        Each input reads its own balance from its locking script (verified by OP_PUSH_TX)
        and writes it to a specific slot in the output based on its position in the
        transaction. Since hash_outputs forces both inputs to agree on the exact same
        output, each input's claimed other_balance must equal the other input's real
        verified balance. This prevents the inflation attack where an attacker lies
        about other_balance.

        The output stores both individual balances (balance and merge_balance) so they
        can be independently verified. Subsequent operations use the sum as the
        available balance.

    Authorization:
        All operations require the current owner's ECDSA signature via check_sig.
    """

    owner: PubKey                    # Current owner's public key. Mutable -- updated on ownership transfer.
    balance: Bigint                  # Primary token balance. Mutable -- adjusted on transfer/split/merge.
    merge_balance: Bigint            # Secondary balance slot used during merge for cross-input verification. Normally 0.
    token_id: Readonly[ByteString]   # Unique token identifier. Readonly -- baked into the locking script, cannot change.

    def __init__(self, owner: PubKey, balance: Bigint, merge_balance: Bigint, token_id: ByteString):
        super().__init__(owner, balance, merge_balance, token_id)
        self.owner = owner
        self.balance = balance
        self.merge_balance = merge_balance
        self.token_id = token_id

    @public
    def transfer(self, sig: Sig, to: PubKey, amount: Bigint, output_satoshis: Bigint):
        """Transfer tokens to a recipient. If the full balance is sent, produces 1 output;
        otherwise produces 2 outputs (recipient + change back to sender).

        Uses add_output to create continuation UTXOs in the spending transaction.
        add_output(satoshis, ...state_values) takes positional state values matching mutable
        properties in declaration order: owner, balance, merge_balance.

        Args:
            sig: Current owner's signature (authorization).
            to: Recipient's public key.
            amount: Number of tokens to send (must be > 0 and <= total available balance).
            output_satoshis: Satoshis to fund each output UTXO.
        """
        assert_(check_sig(sig, self.owner))
        assert_(output_satoshis >= 1)
        total_balance = self.balance + self.merge_balance
        assert_(amount > 0)
        assert_(amount <= total_balance)
        # First output: recipient receives \`amount\` tokens
        self.add_output(output_satoshis, to, amount, 0)
        # Second output: sender keeps the remaining balance as change (skip if fully spent)
        if amount < total_balance:
            self.add_output(output_satoshis, self.owner, total_balance - amount, 0)

    @public
    def send(self, sig: Sig, to: PubKey, output_satoshis: Bigint):
        """Simple send: 1 UTXO -> 1 UTXO. Transfers the entire balance to a new owner.

        Creates a single continuation UTXO with the same balance but a new owner.

        Args:
            sig: Current owner's signature (authorization).
            to: New owner's public key.
            output_satoshis: Satoshis to fund the output UTXO.
        """
        assert_(check_sig(sig, self.owner))
        assert_(output_satoshis >= 1)
        self.add_output(output_satoshis, to, self.balance + self.merge_balance, 0)

    @public
    def merge(self, sig: Sig, other_balance: Bigint, all_prevouts: ByteString, output_satoshis: Bigint):
        """Secure merge: 2 UTXOs -> 1 UTXO. Consolidates two token UTXOs.

        Why this is secure (anti-inflation proof):

        Each input reads its own balance from its locking script (self.balance), which is
        verified by OP_PUSH_TX — it cannot be faked. Each input writes its verified balance
        to a specific output slot based on its position in the transaction.

        Position is derived from all_prevouts (verified against hash_prevouts in the
        preimage, so it reflects the real transaction) and the input's own outpoint.

        The output has two balance slots: balance (slot 0) and merge_balance (slot 1).
        Each input places its own verified balance in its slot, and the claimed other_balance
        in the other slot::

            Input 0 (balance=400): add_output(sats, owner, 400, other_balance_0)
            Input 1 (balance=600): add_output(sats, owner, other_balance_1, 600)

        Both inputs must produce byte-identical outputs (enforced by hash_outputs in BIP-143).
        This forces:
            - slot 0: 400 == other_balance_1  ->  input 1 MUST pass 400
            - slot 1: other_balance_0 == 600  ->  input 0 MUST pass 600

        Any lie causes a hash_outputs mismatch and the transaction is rejected on-chain.
        The inputs can be in any order — each self-discovers its position from the preimage.

        Args:
            sig: Current owner's signature (authorization).
            other_balance: Claimed balance of the other merging input.
            all_prevouts: Concatenated outpoints of all tx inputs (verified via hash_prevouts).
            output_satoshis: Satoshis to fund the merged output UTXO.
        """
        assert_(check_sig(sig, self.owner))
        assert_(output_satoshis >= 1)
        assert_(other_balance >= 0)

        # Verify all_prevouts is authentic (matches the actual transaction inputs)
        assert_(hash256(all_prevouts) == extract_hash_prevouts(self.tx_preimage))

        # Determine position: am I the first contract input?
        my_outpoint = extract_outpoint(self.tx_preimage)
        first_outpoint = substr(all_prevouts, 0, 36)
        my_balance = self.balance + self.merge_balance

        if my_outpoint == first_outpoint:
            # I'm input 0: my verified balance goes to slot 0
            self.add_output(output_satoshis, self.owner, my_balance, other_balance)
        else:
            # I'm input 1: my verified balance goes to slot 1
            self.add_output(output_satoshis, self.owner, other_balance, my_balance)
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
      mergeBalance: 0n,
      tokenId: 'deadbeef',
    },
    methodCall: {
      method: 'send',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'UTXO-based fungible token with transfer, send, and secure merge operations.',
  },
  {
    id: 'zig-token-ft',
    name: 'Fungible Token (Zig)',
    language: 'zig',
    source: `const runar = @import("runar");

pub const FungibleTokenExample = struct {
    pub const Contract = runar.StatefulSmartContract;

    owner: runar.PubKey = "000000000000000000000000000000000000000000000000000000000000000000",
    balance: i64 = 0,
    mergeBalance: i64 = 0,
    tokenId: runar.ByteString,

    pub fn init(owner: runar.PubKey, balance: i64, mergeBalance: i64, tokenId: runar.ByteString) FungibleTokenExample {
        return .{
            .owner = owner,
            .balance = balance,
            .mergeBalance = mergeBalance,
            .tokenId = tokenId,
        };
    }

    pub fn transfer(
        self: *FungibleTokenExample,
        ctx: runar.StatefulContext,
        sig: runar.Sig,
        to: runar.PubKey,
        amount: i64,
        outputSatoshis: i64,
    ) void {
        runar.assert(runar.checkSig(sig, self.owner));
        runar.assert(outputSatoshis >= 1);
        const totalBalance = self.balance + self.mergeBalance;
        runar.assert(amount > 0);
        runar.assert(amount <= totalBalance);

        ctx.addOutput(outputSatoshis, .{ to, amount, 0 });
        if (amount < totalBalance) {
            ctx.addOutput(outputSatoshis, .{ self.owner, totalBalance - amount, 0 });
        }
    }

    pub fn send(self: *FungibleTokenExample, ctx: runar.StatefulContext, sig: runar.Sig, to: runar.PubKey, outputSatoshis: i64) void {
        runar.assert(runar.checkSig(sig, self.owner));
        runar.assert(outputSatoshis >= 1);
        ctx.addOutput(outputSatoshis, .{ to, self.balance + self.mergeBalance, 0 });
    }

    pub fn merge(
        self: *FungibleTokenExample,
        ctx: runar.StatefulContext,
        sig: runar.Sig,
        otherBalance: i64,
        allPrevouts: runar.ByteString,
        outputSatoshis: i64,
    ) void {
        runar.assert(runar.checkSig(sig, self.owner));
        runar.assert(outputSatoshis >= 1);
        runar.assert(otherBalance >= 0);
        runar.assert(runar.bytesEq(runar.hash256(allPrevouts), runar.extractHashPrevouts(ctx.txPreimage)));

        const myOutpoint = runar.extractOutpoint(ctx.txPreimage);
        const firstOutpoint = runar.substr(allPrevouts, 0, 36);
        const myBalance = self.balance + self.mergeBalance;

        if (runar.bytesEq(myOutpoint, firstOutpoint)) {
            ctx.addOutput(outputSatoshis, .{ self.owner, myBalance, otherBalance });
        } else {
            ctx.addOutput(outputSatoshis, .{ self.owner, otherBalance, myBalance });
        }
    }
};
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
      mergeBalance: 0n,
      tokenId: 'deadbeef',
    },
    methodCall: {
      method: 'send',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'UTXO-based fungible token with transfer, send, and secure merge operations.',
  },
  {
    id: 'ruby-token-ft',
    name: 'Fungible Token (Ruby)',
    language: 'ruby',
    source: `require 'runar'

class FungibleToken < Runar::StatefulSmartContract
  prop :owner, PubKey
  prop :balance, Bigint
  prop :merge_balance, Bigint
  prop :token_id, ByteString, readonly: true

  def initialize(owner, balance, merge_balance, token_id)
    super(owner, balance, merge_balance, token_id)
    @owner = owner
    @balance = balance
    @merge_balance = merge_balance
    @token_id = token_id
  end

  runar_public sig: Sig, to: PubKey, amount: Bigint, output_satoshis: Bigint
  def transfer(sig, to, amount, output_satoshis)
    assert check_sig(sig, @owner)
    assert output_satoshis >= 1
    total_balance = @balance + @merge_balance
    assert amount > 0
    assert amount <= total_balance
    add_output(output_satoshis, to, amount, 0)
    if amount < total_balance
      add_output(output_satoshis, @owner, total_balance - amount, 0)
    end
  end

  runar_public sig: Sig, to: PubKey, output_satoshis: Bigint
  def send(sig, to, output_satoshis)
    assert check_sig(sig, @owner)
    assert output_satoshis >= 1
    add_output(output_satoshis, to, @balance + @merge_balance, 0)
  end

  runar_public sig: Sig, other_balance: Bigint, all_prevouts: ByteString, output_satoshis: Bigint
  def merge(sig, other_balance, all_prevouts, output_satoshis)
    assert check_sig(sig, @owner)
    assert output_satoshis >= 1
    assert other_balance >= 0
    assert hash256(all_prevouts) == extract_hash_prevouts(@tx_preimage)
    my_outpoint = extract_outpoint(@tx_preimage)
    first_outpoint = substr(all_prevouts, 0, 36)
    my_balance = @balance + @merge_balance
    if my_outpoint == first_outpoint
      add_output(output_satoshis, @owner, my_balance, other_balance)
    else
      add_output(output_satoshis, @owner, other_balance, my_balance)
    end
  end
end
`,
    constructorArgs: {
      owner: ALICE.pubKey,
      balance: 1000n,
      mergeBalance: 0n,
      tokenId: 'deadbeef',
    },
    methodCall: {
      method: 'send',
      args: [
        { type: 'Sig', signer: 'alice' },
        { type: 'PubKey', value: BOB.pubKey },
        { type: 'bigint', value: '1' },
      ],
    },
    description: 'UTXO-based fungible token with transfer, send, and secure merge operations.',
  },
];
