// Skill names inside a sentence: lower-case the first letter unless it starts with a proper noun or acronym.
const PROPER = /^(Canada|Canadian|Canada's|Ontario|French|First|Indigenous|Shakespearean|Pythagorean|Ohm's|MLA|SMART|EQAO|OSSLT|Big-O|Renaissance|Impressionism|Maslow's|Le|Gibbs)\b/;

/** "Political regions of Canada" → "political regions of Canada"; "Canadian history" stays. */
export function inSentence(skill: string): string {
  if (PROPER.test(skill) || /^[A-Z0-9]{2,}/.test(skill)) return skill;
  return skill.charAt(0).toLowerCase() + skill.slice(1);
}
