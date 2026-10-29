// Sem "use client": o layout (servidor) usa o script, o ThemeToggle (cliente) usa as constantes.

export const THEME_STORAGE_KEY = 'fm-theme';

export const THEME_BY_MODE = { light: 'selvagem', dark: 'selvagem-dark' } as const;

/**
 * Script inline do <head>: aplica a escolha salva antes da primeira pintura, para não piscar o
 * tema errado. Sem escolha, o <html> fica sem data-theme e o daisyUI segue o sistema.
 */
export const themeInitScript = `try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');if(m==='light')document.documentElement.setAttribute('data-theme','${THEME_BY_MODE.light}');else if(m==='dark')document.documentElement.setAttribute('data-theme','${THEME_BY_MODE.dark}');}catch(e){}`;
