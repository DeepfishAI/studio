import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const PRODUCTS_CSV = join(ROOT, 'products.csv');

/**
 * Parse CSV into array of objects
 */
export function getProducts() {
    if (!existsSync(PRODUCTS_CSV)) {
        console.error('Products CSV not found at:', PRODUCTS_CSV);
        return [];
    }

    try {
        const content = readFileSync(PRODUCTS_CSV, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const headers = lines[0].split(',');

        return lines.slice(1).map(line => {
            const values = line.split(',');
            const product = {};
            headers.forEach((header, index) => {
                let value = values[index]?.trim();

                // Convert numbers
                if (!isNaN(value) && value !== '') {
                    value = Number(value);
                }

                product[header.trim()] = value;
            });
            return product;
        });
    } catch (err) {
        console.error('Failed to parse products CSV:', err);
        return [];
    }
}

/**
 * Get product by ID
 */
export function getProductById(id) {
    const products = getProducts();
    return products.find(p => p.id === id);
}
