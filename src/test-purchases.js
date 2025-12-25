import { getGlobalCapacity, loadUserData, saveUserData } from './src/user.js';
import { getProducts, getProductById } from './src/products.js';

console.log('🧪 Testing Purchase -> Capacity Integration');

// 1. Reset user data
const originalData = loadUserData();
const testData = {
    ...originalData,
    purchases: [],
    capacities: { any: 2 }
};
saveUserData(testData);
console.log(`\n1. Reset user capacity to: ${getGlobalCapacity()}`);

// 2. Load products
const products = getProducts();
const expansionPack = products.find(p => p.id === 'office_pack_5');
console.log(`\n2. Found expansion pack: "${expansionPack.name}" (Effect: +${expansionPack.effect_value})`);

// 3. Simulate purchase
console.log('\n3. Simulating purchase...');
const product = getProductById('office_pack_5');
testData.purchases.push({
    productId: product.id,
    name: product.name,
    timestamp: new Date().toISOString()
});
const agent = product.target_agent || 'any';
testData.capacities[agent] = (testData.capacities[agent] || 0) + (product.effect_value || 1);
saveUserData(testData);

// 4. Verify new capacity
const newCapacity = getGlobalCapacity();
console.log(`\n4. New user capacity: ${newCapacity}`);

if (newCapacity === 7) {
    console.log('\n✅ SUCCESS: Capacity increased correctly!');
} else {
    console.log(`\n❌ FAILURE: Expected capacity 7, got ${newCapacity}`);
    process.exit(1);
}

// Restore original data for the user
saveUserData(originalData);
