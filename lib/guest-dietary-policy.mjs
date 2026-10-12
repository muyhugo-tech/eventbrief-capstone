export const GUEST_DIETARY_POLICY = 'host-raised-dietary-v1';
export const PROFILE_READINESS_POLICY = 'profile-only-v1';

const hostRoles = new Set(['host', 'customer', 'client']);
const dietaryTopic = /\b(?:allerg(?:y|ies|ic|ens?)|dietary|food\s+(?:restrictions?|requirements?|needs?)|intoleran(?:ce|ces|t)|coeliac|celiac|vegan|vegetarian|gluten[ -]free|nut[ -]free)\b/i;

// Pasted messages retain their original body. Recognize explicit speaker labels
// locally; restaurant questions and internal notes do not become host requests.
function hostPassages(message, hostName) {
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

export function hostRaisedDietary(input, original) {
  // Use the source identity, not a coordinator's display-name correction.
  const hostName = original.fields.host_name.value;
  return input.messages.some(message => hostPassages(message, hostName).some(text => dietaryTopic.test(text)));
}
