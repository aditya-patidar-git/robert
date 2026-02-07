import Allowlist from "../models/Allowlist.js";

function getClientIp(req) {
    const raw = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || '';
    const trimmed = raw.trim();
    if (trimmed.startsWith('::ffff:')) return trimmed.replace('::ffff:', '');
    return trimmed;
}

export function ipAllowlistMiddleware(req, res, next) {
    if (process.env.ALLOWLIST_BYPASS_EMERGENCY === '1' || process.env.ALLOWLIST_BYPASS_EMERGENCY === 'true') {
        return next();
    }
    if (!process.env.IP_ALLOWLIST_ENABLED || process.env.IP_ALLOWLIST_ENABLED === '0' || process.env.IP_ALLOWLIST_ENABLED === 'false') {
        return next();
    }

    const clientIp = getClientIp(req);
    if (!clientIp) {
        return res.status(403).json({ message: "Access denied by IP policy" });
    }

    Allowlist.countDocuments({ type: 'ip' })
        .then((count) => {
            if (count === 0) return next();
            return Allowlist.findOne({ type: 'ip', value: clientIp }).then((entry) => {
                if (entry) return next();
                return res.status(403).json({ message: "Access denied by IP policy" });
            });
        })
        .catch((err) => {
            console.error("IP allowlist check error:", err);
            return res.status(500).json({ message: "Internal server error" });
        });
}

let bypassLogged = false;
export function logBypassIfActive() {
    if (bypassLogged) return;
    if (process.env.ALLOWLIST_BYPASS_EMERGENCY === '1' || process.env.ALLOWLIST_BYPASS_EMERGENCY === 'true') {
        console.warn("⚠️ IP allowlist bypass is ENABLED (ALLOWLIST_BYPASS_EMERGENCY). Use for emergency only.");
        bypassLogged = true;
    }
}
