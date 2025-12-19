// bigint-factorial.js
function factorialBig(n) {
    if (!Number.isInteger(n) || n < 0) {
        throw new Error('Input must be a non-negative integer');
    }
    
    if (n === 0 || n === 1) {
        return 1n;
    }
    
    let result = 1n;
    for (let i = 2n; i <= BigInt(n); i++) {
        result *= i;
    }
    
    return result;
}