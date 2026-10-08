const lookup: Record<string, string> = {
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
    "<": "&lt;",
    ">": "&gt;"
}

export default function escapeHTML(s: any): string {
    return String(s).replace(/[&"'<>]/g, c => lookup[c] || c)
}
