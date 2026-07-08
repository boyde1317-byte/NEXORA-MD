import { asciiBuilder } from '../asciiBuilder.js';

export const profileTemplate = (profileData) => {
  const lines = [
    `👤 Name: ${profileData.name || 'Unknown User'}`,
    `📱 Number: @${profileData.jid?.split('@')[0] || 'N/A'}`,
    `🏅 Status: ${profileData.status || 'Active Member'}`,
    `📅 Registered: ${profileData.registeredDate || 'Today'}`
  ];
  return asciiBuilder.box('USER PROFILE', lines);
};

export default profileTemplate;
