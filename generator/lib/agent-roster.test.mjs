import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAgentContact } from './agent-roster.mjs';

test('getAgentContact: returns full contact details for a known consultant', () => {
  const agent = getAgentContact('Angelo Salgado');
  assert.equal(agent.name, 'Angelo Salgado');
  assert.equal(agent.email, 'angelo@fairopportunityrealestate.com');
  assert.equal(agent.whatsapp, '971553185538');
  assert.ok(agent.phone);
  assert.ok(agent.photo);
});

test('getAgentContact: returns null for an unrecognized name (never invents contact info)', () => {
  assert.equal(getAgentContact('Someone Not On The Team'), null);
});

test('getAgentContact: returns null for empty/undefined input', () => {
  assert.equal(getAgentContact(''), null);
  assert.equal(getAgentContact(undefined), null);
});
