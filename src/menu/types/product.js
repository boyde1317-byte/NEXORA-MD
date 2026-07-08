import { baileysBridge } from '../../core/baileysBridge.js';
import { buildTextMenu } from '../formatter.js';
import { imageManager } from '../../images/imageManager.js';
import { footerManager } from '../../core/footer.js';

export const productMenu = {
  id: 5,
  name: 'product',
  description: 'Product Catalog/Shop style menu showcase',
  supportedMessages: ['productMessage'],

  renderer: async ({ sock, m, menuData }) => {
    // Dynamically query image selector for style 5
    const imgData = await imageManager.getMenuImage(5);

    const productTitle = `🛒 ${menuData.botName.toUpperCase()} CONSOLE`;
    const productDesc = `Complete Multi-Device Command catalog.\n\n` + buildTextMenu(menuData);
    
    // Send standard Product message using the bridge helper
    return await baileysBridge.sendProduct(sock, m.from, {
      productId: 'bot-service-pack-01',
      title: productTitle,
      description: productDesc,
      currency: 'USD',
      price: 1.99, // Interactive pricing placeholder
      footer: footerManager.getFooter()
    }, { quoted: m });
  }
};

export default productMenu;
