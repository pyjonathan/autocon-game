// Hand-written fixtures copied from the spec's "Reference Scenario Data".
// They are deliberately independent of data/levels.json so the tests do not
// depend on the content file (or on the code under test).

const MAC_A = '00:aa:00:00:00:01';

function ports4() {
  return ['gi0-1', 'gi0-2', 'gi0-3', 'gi0-4'].map((id) => ({ id, label: id.replace('gi0-', 'Gi0/') }));
}

const switchGates = () => [
  { id: 'gi0-1', label: 'Gi0/1' }, { id: 'gi0-2', label: 'Gi0/2' },
  { id: 'gi0-3', label: 'Gi0/3' }, { id: 'gi0-4', label: 'Gi0/4' },
  { id: 'flood', label: 'Flood' }, { id: 'drop', label: 'Drop' },
];

function swRound(id, dstMac, dstIp) {
  return {
    id, title: id, prompt: 'p', ingress: 'gi0-1',
    packet: { srcMac: MAC_A, dstMac, srcIp: '10.0.0.1', dstIp, protocol: 'TCP', dstPort: 443, ttl: 64 },
    gates: switchGates(), help: { method: 'm', steps: ['s'] }, misconceptions: {},
  };
}

export function makeSwitchLevel() {
  return {
    id: 'fx-switch', title: 'Switch', device: 'switch', outcome: 'LO1', sourceIds: [],
    table: {
      name: 'SW1',
      ports: ports4(),
      macEntries: [
        { mac: '00:aa:00:00:00:01', portId: 'gi0-1' },
        { mac: '00:aa:00:00:00:02', portId: 'gi0-2' },
        { mac: '00:aa:00:00:00:03', portId: 'gi0-3' },
      ],
    },
    rounds: [swRound('l1r1', '00:aa:00:00:00:03', '10.0.0.3'), swRound('l1r2', '00:aa:00:00:00:09', '10.0.0.9')],
  };
}

const routerGates = () => [
  { id: 'gi0-0', label: 'Gi0/0' }, { id: 'gi0-1', label: 'Gi0/1' },
  { id: 'gi0-2', label: 'Gi0/2' }, { id: 'drop', label: 'Drop' },
];

function rtRound(id, dstIp, display) {
  return {
    id, title: id, prompt: 'p', ingress: 'gi0-0',
    packet: { srcMac: '00:aa:00:00:01:0a', dstMac: '00:bb:00:00:00:01', srcIp: '192.168.1.10', dstIp, protocol: 'TCP', dstPort: 443, ttl: 64 },
    gates: routerGates(), display, help: { method: 'm', steps: ['s'] }, misconceptions: {},
  };
}

export function makeRouterLevel() {
  return {
    id: 'fx-router', title: 'Router', device: 'router', outcome: 'LO2', sourceIds: [],
    table: {
      name: 'R1',
      interfaces: [
        { id: 'gi0-0', label: 'Gi0/0', address: '192.168.1.1', prefixLength: 24 },
        { id: 'gi0-1', label: 'Gi0/1', address: '192.168.2.1', prefixLength: 24 },
        { id: 'gi0-2', label: 'Gi0/2', address: '203.0.113.2', prefixLength: 30 },
      ],
      routes: [
        { prefix: '192.168.1.0', prefixLength: 24, interfaceId: 'gi0-0' },
        { prefix: '192.168.2.0', prefixLength: 24, interfaceId: 'gi0-1' },
        { prefix: '0.0.0.0', prefixLength: 0, interfaceId: 'gi0-2', nextHop: '203.0.113.1' },
      ],
    },
    rounds: [
      rtRound('l2r1', '192.168.2.77', { rewrittenSrcMac: '00:bb:00:00:00:02', rewrittenDstMac: '00:cc:00:00:02:4d' }),
      rtRound('l2r2', '192.168.3.10', { rewrittenSrcMac: '00:bb:00:00:00:03', rewrittenDstMac: '00:dd:00:00:00:01' }),
    ],
  };
}

const firewallGates = () => [
  { id: 'rule-1', label: 'Rule 1' }, { id: 'rule-2', label: 'Rule 2' },
  { id: 'rule-3', label: 'Rule 3' }, { id: 'implicit-deny', label: 'Implicit deny' },
];

function fwRound(id, protocol, dstPort) {
  return {
    id, title: id, prompt: 'p',
    packet: { srcMac: '00:aa:00:00:01:14', dstMac: '00:ee:00:00:00:01', srcIp: '10.1.1.20', dstIp: '203.0.113.10', protocol, dstPort, ttl: 64 },
    gates: firewallGates(), help: { method: 'm', steps: ['s'] }, misconceptions: {},
  };
}

export function makeFirewallLevel() {
  return {
    id: 'fx-firewall', title: 'Firewall', device: 'firewall', outcome: 'LO3', sourceIds: [],
    table: {
      name: 'FW1',
      rules: [
        { id: 'rule-1', action: 'DENY', protocol: 'TCP', dstPort: 23 },
        { id: 'rule-2', action: 'PERMIT', protocol: 'TCP', dstPort: 'any' },
        { id: 'rule-3', action: 'PERMIT', protocol: 'UDP', dstPort: 53 },
      ],
    },
    rounds: [fwRound('l3r1', 'TCP', 23), fwRound('l3r2', 'UDP', 443)],
  };
}

export function makeFixtureDocument() {
  return {
    schemaVersion: 1,
    sources: [{ id: 'src-1', title: 'T', url: 'https://example.org', section: 's', claim: 'c' }],
    levels: [makeSwitchLevel(), makeRouterLevel(), makeFirewallLevel()].map((level) => ({
      ...level,
      sourceIds: ['src-1'],
      briefing: {
        intro: 'i', reads: 'r', terms: [{ term: 't', definition: 'd' }],
        example: { heading: 'h', text: 't' }, boundaries: ['b'],
      },
    })),
  };
}
