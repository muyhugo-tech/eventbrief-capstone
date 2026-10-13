export const GUEST_DIETARY_POLICY = 'host-raised-dietary-v2';
export const GUEST_DIETARY_V1 = 'host-raised-dietary-v1';
export const PROFILE_READINESS_POLICY = 'profile-only-v1';

const hostRoles = new Set(['host', 'customer', 'client']);
const dietaryTopic = /\b(?:allerg(?:y|ies|ic|ens?)|dietary|food\s+(?:restrictions?|requirements?|needs?)|intoleran(?:ce|ces|t)|coeliac|celiac|vegan|vegetarian|gluten[ -]free|nut[ -]free)\b/i;

// Pasted messages retain their original body. Recognize explicit speaker labels
// locally; restaurant questions and internal notes do not become host requests.
function hostPassagesV1(message, hostName) {
  if (hostRoles.has(message.role?.toLowerCase())) return [message.body];
  if (message.role !== 'conversation') return [];
  const passages = [];
  let isHost = false;
  for (const line of message.body.split(/\r?\n/)) {
    const label = line.match(/^\s*([^:\r\n]{1,120}):\s*(.*)$/);
    if (label) {
      const name = label[1].trim().toLowerCase();
      const role = name.split(/\s+[—–-]\s+/)[0];
      const knownRole = hostRoles.has(role) || /^(?:restaurant|coordinator|staff|internal staff note|internal note)$/.test(role);
      const namedHost = Boolean(hostName && name === hostName.toLowerCase());
      if (knownRole || namedHost || !label[2]) {
        isHost = hostRoles.has(role) || namedHost;
        if (isHost && label[2]) passages.push(label[2]);
        continue;
      }
    }
    if (isHost && !line.trimStart().startsWith('>')) passages.push(line);
  }
  return passages;
}

const nameKey = name => String(name ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const speakerLabel = /^\s*([\p{L}][^:\r\n]{0,119}):\s*(.*)$/u;
const restaurantRole = /^(?:restaurant|coordinator|staff|internal staff note|internal note)$/;
const personLabel = /^[\p{L}\p{M}][\p{L}\p{M}.'’-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}.'’-]*){0,3}$/u;
function parseSpeaker(line) {
  const match=line.match(speakerLabel);
  if (!match) return null;
  const label=nameKey(match[1]),role=label.split(/\s+[—–-]\s+/)[0];
  if (hostRoles.has(role)||restaurantRole.test(role)) return match;
  // Times in a sentence and content headings are not speaker changes.
  // A sentence such as "I've checked with everyone: no allergies" remains
  // part of the current speaker's message, even though its prefix has a colon.
  if (/^(?:i|we|you|my|our|your)\b/i.test(label)) return null;
  if (dietaryTopic.test(label)||/^(?:guest instructions|staff instructions|event details|drink notes|notes)$/.test(label)) return null;
  return personLabel.test(match[1].trim()) ? match : null;
}

function hostAliases(input, hostName) {
  const full = nameKey(hostName), first = full.split(' ')[0], aliases = new Set(full ? [full] : []);
  // Do not guess which Jordan a first-name label refers to when two different
  // full-name speakers share that name. An explicit self-introduction can
  // disambiguate that label; arbitrary surnames never become host aliases.
  const labels = input.messages.filter(m=>m.role==='conversation').flatMap(m=>m.body.split(/\r?\n/).map(parseSpeaker).filter(Boolean));
  const otherNames = labels.some(([,label])=>nameKey(label).startsWith(first+' ') && nameKey(label)!==full);
  const escaped = full.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const introduction = new RegExp(`\\b(?:i['’]m|i am|my name is|this is)\\s+${escaped}(?=$|[\\s.,!?])`,'i');
  const introduced = full && labels.some(([,label,body])=>nameKey(label)===first && introduction.test(body));
  if (full && first!==full && (!otherNames || introduced)) aliases.add(first);
  return aliases;
}

function hostPassagesV2(message, aliases) {
  if (hostRoles.has(message.role?.toLowerCase())) return [message.body];
  if (message.role !== 'conversation') return [];
  const passages=[];
  let isHost=false;
  for (const line of message.body.split(/\r?\n/)) {
    if (line.trimStart().startsWith('>')) continue;
    const label=parseSpeaker(line);
    if (label) {
      const name=nameKey(label[1]), role=name.split(/\s+[—–-]\s+/)[0];
      isHost=!restaurantRole.test(role) && (hostRoles.has(role) || aliases.has(name));
      if (isHost && label[2]) passages.push(label[2]);
      continue;
    }
    if (isHost) passages.push(line);
  }
  return passages;
}

export function hostRaisedDietary(input, original, policy = GUEST_DIETARY_POLICY) {
  // Use the source identity, not a coordinator's display-name correction.
  const hostName = original.fields.host_name.value;
  if (policy !== GUEST_DIETARY_POLICY) return input.messages.some(message => hostPassagesV1(message, hostName).some(text => dietaryTopic.test(text)));
  const aliases=hostAliases(input,hostName);
  return input.messages.some(message => hostPassagesV2(message, aliases).some(text => dietaryTopic.test(text)));
}
