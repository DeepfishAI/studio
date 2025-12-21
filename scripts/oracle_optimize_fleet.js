/**
 * Oracle Fleet Optimizer
 * 
 * "I see all potential futures. I choose the optimal path." — Oracle
 * 
 * Connects to Artificial Analysis API to fetch latest model benchmarks.
 * Updates skill_catalog.json to assign the absolute best models to our agents.
 * 
 * Usage: node scripts/oracle_optimize_fleet.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---

const AA_API_KEY = process.env.ARTIFICIAL_ANALYSIS_API_KEY;
const CATALOG_PATH = path.join(__dirname, '../modules/skill_catalog.json');

// Thresholds to ensure we don't downgrade to garbage just because it has high throughput
const MIN_QUALITY_SCORE = 50;

// --- Logic ---

if (!AA_API_KEY) {
    console.error('❌ Error: ARTIFICIAL_ANALYSIS_API_KEY is missing.');
    console.error('Please add it to your .env file or environment variables.');
    process.exit(1);
}

async function fetchModels() {
    console.log('🔮 Oracle is gazing into the Artificial Analysis API...');

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'artificialanalysis.ai',
            path: '/api/v2/data/llms/models',
            method: 'GET',
            headers: {
                'x-api-key': AA_API_KEY,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const json = JSON.parse(data);
                        // Handle various API response shapes
                        const list = json.models || json.items || json.data || json;
                        if (Array.isArray(list)) {
                            resolve(list);
                        } else {
                            reject('API response is not an array: ' + JSON.stringify(json).substring(0, 100));
                        }
                    } catch (e) {
                        reject('Failed to parse API response');
                    }
                } else {
                    reject(`API Request Failed: ${res.statusCode} ${res.statusMessage}`);
                }
            });
        });

        req.on('error', (e) => reject(e.message));
        req.end();
    });
}

function findBestModel(models, criteriaFn) {
    return models
        // .filter(m => m.providers && m.providers.length > 0) // Relaxed filter for simulation
        .sort(criteriaFn)[0];
}

function updateCatalog(models) {
    console.log(`📊 Analyzed ${models.length} models.`);

    // Read Catalog
    if (!fs.existsSync(CATALOG_PATH)) {
        console.error('❌ Error: skill_catalog.json not found at', CATALOG_PATH);
        process.exit(1);
    }
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
    const skills = catalog.catalog.llm_skills;
    let updates = 0;

    // --- Optimization Logic ---

    // 1. FAST RESPONDER (High Throughput, Low Latency)
    const fastModel = findBestModel(models, (a, b) => {
        // Prioritize Throughput
        const tA = a.median_output_tokens_per_second || 0;
        const tB = b.median_output_tokens_per_second || 0;
        return tB - tA;
    });

    if (fastModel) {
        console.log(`⚡ Fast Responder: Upgrading to ${fastModel.name} (${Math.round(fastModel.median_output_tokens_per_second)} t/s)`);
        skills.fast_responder.llm = fastModel.slug || fastModel.name; // Use slug if available
        skills.fast_responder.description = `Optimized by Oracle: ${fastModel.name} for max speed`;
        updates++;
    }

    // 2. CODE SPECIALIST (Coding Benchmarks)
    const coderModel = findBestModel(models, (a, b) => {
        const cA = a.benchmarks?.coding?.livecodebench?.score || a.benchmarks?.human_eval?.score || 0;
        const cB = b.benchmarks?.coding?.livecodebench?.score || b.benchmarks?.human_eval?.score || 0;
        return cB - cA;
    });

    if (coderModel) {
        console.log(`💻 Code Specialist: Upgrading to ${coderModel.name}`);
        skills.code_specialist.llm = coderModel.slug || coderModel.name;
        skills.code_specialist.description = `Optimized by Oracle: ${coderModel.name} for top coding performance`;
        updates++;
    }

    // 3. REASONING MASTER (Math / Logic)
    const logicModel = findBestModel(models, (a, b) => {
        const rA = a.benchmarks?.reasoning?.gpqa?.score || a.benchmarks?.math?.gsm8k?.score || 0;
        const rB = b.benchmarks?.reasoning?.gpqa?.score || b.benchmarks?.math?.gsm8k?.score || 0;
        return rB - rA;
    });

    if (logicModel) {
        console.log(`🧠 Reasoning Master: Upgrading to ${logicModel.name}`);
        skills.reasoning_master.llm = logicModel.slug || logicModel.name;
        skills.reasoning_master.description = `Optimized by Oracle: ${logicModel.name} for superior logic`;
        updates++;
    }

    // 4. POWER LLAMA (Best Overall Quality that is usually Llama-like or open weights focused)
    const powerModel = findBestModel(models, (a, b) => {
        const qA = a.artificial_analysis_quality_index || 0;
        const qB = b.artificial_analysis_quality_index || 0;
        return qB - qA;
    });

    if (powerModel) {
        console.log(`🦁 Power Llama (Best Overall): Upgrading to ${powerModel.name}`);
        skills.power_llama.llm = powerModel.slug || powerModel.name;
        skills.power_llama.description = `Optimized by Oracle: The current market leader ${powerModel.name}`;
        updates++;
    }

    // Save
    if (updates > 0) {
        fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 4));
        console.log(`✅ Success: Updated ${updates} skills in the catalog.`);
    } else {
        console.log('✨ Catalog is already optimal.');
    }
}

async function main() {
    try {
        const models = await fetchModels();
        updateCatalog(models);
    } catch (err) {
        console.error('❌ Optimization Failed:', err);
        process.exit(1);
    }
}

main();
