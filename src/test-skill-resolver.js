/**
 * Test script for skill-resolver module
 */

import { resolveSkill, listAvailableSkills, canAccessSkill, getAllSkillsWithAccess } from './skill-resolver.js';

console.log('=== Skill Resolver Test ===\n');

// Test 1: Resolve skill for each agent with free tier
console.log('--- Test 1: Free Tier Skill Resolution ---');
const agents = ['mei', 'oracle', 'vesper', 'hanna', 'it', 'sally'];

for (const agent of agents) {
    const result = resolveSkill(agent, 'free');
    console.log(`${agent}: ${result.skillId} → ${result.llm} (${result.source})`);
}

// Test 2: Resolve skill for IT with different tiers
console.log('\n--- Test 2: IT Skill Resolution by Tier ---');
for (const tier of ['free', 'pro', 'premium', 'platinum']) {
    const result = resolveSkill('it', tier);
    console.log(`  ${tier}: ${result.skillId} → ${result.llm}`);
}

// Test 3: List available skills for each tier
console.log('\n--- Test 3: Available Skills per Tier ---');
for (const tier of ['free', 'pro', 'premium', 'platinum']) {
    const skills = listAvailableSkills(tier);
    console.log(`  ${tier}: ${skills.length} skills available`);
}

// Test 4: Check tier access
console.log('\n--- Test 4: Tier Access Checks ---');
console.log(`  free can access fast_responder: ${canAccessSkill('fast_responder', 'free')}`);
console.log(`  free can access mega_llama: ${canAccessSkill('mega_llama', 'free')}`);
console.log(`  platinum can access mega_llama: ${canAccessSkill('mega_llama', 'platinum')}`);

console.log('\n=== All Tests Complete ===');
