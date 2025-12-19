// factorial.js

/**
 * Calculates the factorial of a non-negative integer
 * @param {number} n - The number to calculate factorial for
 * @returns {number} The factorial of n
 * @throws {Error} If n is negative or not an integer
 */
function factorial(n) {
    // Input validation
    if (!Number.isInteger(n)) {
        throw new Error('Input must be an integer');
    }
    
    if (n < 0) {
        throw new Error('Factorial is not defined for negative numbers');
    }
    
    // Base cases
    if (n === 0 || n === 1) {
        return 1;
    }
    
    // Iterative approach for better performance
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    
    return result;
}

// Example usage
console.log(factorial(5));  // Output: 120
console.log(factorial(0));  // Output: 1
console.log(factorial(1));  // Output: 1