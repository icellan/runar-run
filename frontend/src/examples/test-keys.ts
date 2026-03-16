/**
 * Pre-generated deterministic test keys from runar-testing.
 * Used to populate constructor args and create real signatures in the playground.
 */

export interface TestKey {
  name: string;
  privKey: string;
  pubKey: string;
  pubKeyHash: string;
}

export const ALICE: TestKey = {
  name: 'alice',
  privKey: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  pubKey: '03a34b99f22c790c4e36b2b3c2c35a36db06226e41c692fc82b8b56ac1c540c5bd',
  pubKeyHash: '9a1c78a507689f6f54b847ad1cef1e614ee23f1e',
};

export const BOB: TestKey = {
  name: 'bob',
  privKey: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  pubKey: '03d6bfe100d1600c0d8f769501676fc74c3809500bd131c8a549f88cf616c21f35',
  pubKeyHash: '89b460e4e984ef496ff0b135712f3d9b9fc80482',
};

export const CHARLIE: TestKey = {
  name: 'charlie',
  privKey: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  pubKey: '02c6b754b20826eb925e052ee2c25285b162b51fdca732bcf67e39d647fb6830ae',
  pubKeyHash: '66c1d8577d77be82e3e0e6ac0e14402e3fc67ff3',
};

export const TEST_KEYS_BY_NAME: Record<string, TestKey> = {
  alice: ALICE,
  bob: BOB,
  charlie: CHARLIE,
};
