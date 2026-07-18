import brand from '../../config/brand.js';
import layoutConfig from '../../config/layout.js';

export const footerManager = {
  getStyle() {
    return layoutConfig.footerStyle || 'clean';
  },

  setStyle(style) {
    layoutConfig.footerStyle = style;
  },

  getFooter(customStyle) {
    const style = customStyle || this.getStyle();
    switch (style) {
      case 'minimal':
        return `Powered by ${brand.core}`;
      case 'professional':
      case 'ornate':
        return `© ${brand.name} Framework`;
      case 'clean':
      case 'default':
      default:
        return `${brand.name} • ${brand.signature}`;
    }
  }
};

export default footerManager;
