import Provenance from '../database/models/Provenance.js';

const MAX_PROVENANCE_ENTRIES = 100;

/**
 * Get provenance entries for a call, flattened for CallRecord.provenance.
 * @param {string} callSid - Call SID (callId in Provenance)
 * @returns {Promise<Array<{fileId, fileName, similarityScore, content, timestamp}>>}
 */
export async function getProvenanceForCall(callSid) {
  if (!callSid) return [];
  try {
    const docs = await Provenance.find({ callId: callSid })
      .sort({ timestamp: 1 })
      .limit(50)
      .lean();
    const entries = [];
    for (const doc of docs) {
      const ts = doc.timestamp || new Date();
      const results = doc.results || [];
      for (const r of results) {
        if (entries.length >= MAX_PROVENANCE_ENTRIES) break;
        entries.push({
          fileId: r.fileId || null,
          fileName: r.fileName || 'Unknown',
          similarityScore: r.similarityScore ?? 0,
          content: (r.content && String(r.content).substring(0, 500)) || '',
          timestamp: ts
        });
      }
    }
    return entries;
  } catch (err) {
    console.warn(`[provenanceService] getProvenanceForCall(${callSid}) failed:`, err.message);
    return [];
  }
}

export default { getProvenanceForCall };
