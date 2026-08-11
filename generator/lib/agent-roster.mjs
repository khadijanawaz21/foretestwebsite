/**
 * generator/lib/agent-roster.mjs
 * Static roster of FORE real-estate consultants who can be assigned to a
 * secondary listing (see the "Agent Name" select in admin.html — the
 * `agent` column on `secondary_listings` always holds one of these exact
 * names, or is empty). Independent of property-detail.html by design
 * (Release 1.0.1: the off-plan implementation is frozen and not read
 * from) — these are the same real, already-published contact details
 * (also listed in team-directory.txt), just not shared code.
 */

const ROSTER = {
  'Abdel': {
    photo: '',
    role: 'Real Estate Consultant',
    languages: 'English, Arabic',
    email: 'info@fairopportunityrealestate.com',
    whatsapp: '971542445867',
    phone: '+971 54 244 5867',
  },
  'Angelo Salgado': {
    photo: '/assets/team/Angelo.jpeg',
    role: 'Real Estate Consultant',
    languages: 'English',
    email: 'angelo@fairopportunityrealestate.com',
    whatsapp: '971553185538',
    phone: '+971 55 318 5538',
  },
  'Mohammed Seddik Gacem': {
    photo: '/assets/team/seddik.jpeg',
    role: 'Real Estate Consultant',
    languages: 'English, Arabic, French',
    email: 'mohammedseddik@fairopportunityrealestate.com',
    whatsapp: '971522720013',
    phone: '+971 52 272 0013',
  },
  'Mohamad Asif': {
    photo: '/assets/team/asif.jpeg',
    role: 'Real Estate Consultant',
    languages: 'English, Hindi',
    email: 'mohamadasif@fairopportunityrealestate.com',
    whatsapp: '917895167309',
    phone: '+91 789 516 7309',
  },
  'Mohammed Abubakker Sajjad': {
    photo: '/assets/team/sajjad.jpeg',
    role: 'Real Estate Consultant',
    languages: 'English',
    email: 'sajjad@fairopportunityrealestate.com',
    whatsapp: '971509066257',
    phone: '+971 50 906 6257',
  },
};

/**
 * @param {string|undefined} name Exact value of the listing's `agent` field.
 * @returns {{name: string, photo: string, role: string, languages: string, email: string, whatsapp: string, phone: string} | null}
 *   null when `name` is empty or doesn't match a known consultant — callers
 *   must omit the agent section rather than invent contact details.
 */
export function getAgentContact(name) {
  if (!name || !Object.prototype.hasOwnProperty.call(ROSTER, name)) return null;
  return { name, ...ROSTER[name] };
}
