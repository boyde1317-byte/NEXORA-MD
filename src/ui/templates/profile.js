export const profileTemplate = (profileData) => {
  return `✦ *USER PROFILE* ✦
👤 *Name:* ${profileData.name || 'Unknown User'}
📱 *Number:* @${profileData.jid?.split('@')[0] || 'N/A'}
🏅 *Status:* ${profileData.status || 'Active Member'}
📅 *Registered:* ${profileData.registeredDate || 'Today'}`;
};

export default profileTemplate;
