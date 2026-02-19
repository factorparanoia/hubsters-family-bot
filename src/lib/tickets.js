const { readJson, writeJson } = require('./store');

function ticketsKey(guildId) {
  return `tickets-${guildId}`;
}

function ticketCounterKey(guildId) {
  return `ticket-counter-${guildId}`;
}

function nextTicketNumber(guildId) {
  const current = readJson(ticketCounterKey(guildId), { value: 0 });
  const next = current.value + 1;
  writeJson(ticketCounterKey(guildId), { value: next });
  return next;
}

function saveTicket(guildId, ticket) {
  const all = readJson(ticketsKey(guildId), {});
  all[ticket.channelId] = ticket;
  writeJson(ticketsKey(guildId), all);
}

function getTicketByChannel(guildId, channelId) {
  const all = readJson(ticketsKey(guildId), {});
  return all[channelId] || null;
}

function closeTicket(guildId, channelId, closedBy) {
  const all = readJson(ticketsKey(guildId), {});
  if (!all[channelId]) return null;
  all[channelId].status = 'closed';
  all[channelId].closedAt = new Date().toISOString();
  all[channelId].closedBy = closedBy;
  writeJson(ticketsKey(guildId), all);
  return all[channelId];
}

module.exports = {
  nextTicketNumber,
  saveTicket,
  getTicketByChannel,
  closeTicket
};
