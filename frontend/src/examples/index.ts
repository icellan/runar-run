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
];
