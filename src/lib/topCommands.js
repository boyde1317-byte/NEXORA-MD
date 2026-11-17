/**
 * topCommands.js — the most-run commands, ranked from recorded usage.
 *
 * The dispatcher bumps `db.stats.commandsUsed[command.name]` on every successful
 * dispatch, and that counter survives restarts. Menus read it through here
 * instead of keeping a list of guesses, so "popular" means the bot was actually
 * driven that way and a quiet bot admits it by returning nothing.
 *
 * Three filters, each for a reason:
 *   - a name that no longer resolves is dropped (plugins come and go, and a dead
 *     id in a menu row is a tap that does nothing)
 *   - a command with no category is internal bookkeeping, never a menu entry
 *   - the owner and hidden buckets stay out: the picker is open to everyone
 *
 * Ties fall back to the name so the same registry always ranks the same way.
 */

export const TOP_COMMANDS = 5;

export const rankTopCommands = (commandsUsed = {}, commands, limit = TOP_COMMANDS) => {
  if (!commands || typeof commands.get !== 'function') return [];

  return Object.entries(commandsUsed || {})
    .map(([name, uses]) => ({ name, uses: Number(uses) || 0, cmd: commands.get(name) }))
    .filter(({ cmd }) => {
      const cat = (cmd?.category || '').toLowerCase();
      return Boolean(cat) && cat !== 'owner' && cat !== 'hidden';
    })
    .filter(({ uses }) => uses > 0)
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, uses, cmd }) => ({ name, uses, category: (cmd.category || '').toLowerCase() }));
};

export default rankTopCommands;
