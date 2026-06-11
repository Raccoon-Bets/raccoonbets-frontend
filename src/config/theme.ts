import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

/**
 * PrimeVue preset for the Sticker Club design system. Maps PrimeVue's
 * semantic tokens onto the Candy Cream / Raccoon Night palettes so behavioral
 * widgets (inputs, selects, menus, datatables) match the custom sticker
 * primitives. Values mirror the `--rb-*` custom properties in
 * src/styles/_tokens.scss.
 */
export default definePreset(Aura, {
  primitive: {
    borderRadius: {
      xs: '6px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '18px',
    },
  },
  semantic: {
    primary: {
      50: '#fff9e6',
      100: '#ffefbf',
      200: '#ffe695',
      300: '#ffdd6b',
      400: '#ffd74f',
      500: '#ffd23f',
      600: '#f2c531',
      700: '#e0b324',
      800: '#cfa118',
      900: '#b08812',
      950: '#8a690c',
    },
    colorScheme: {
      light: {
        primary: {
          color: '#ffd23f',
          contrastColor: '#1a1a1a',
          hoverColor: '#f2c531',
          activeColor: '#e0b324',
        },
        surface: {
          0: '#ffffff',
          50: '#fff8e7',
          100: '#f7edd3',
          200: '#f3e3b9',
          300: '#e3d2a4',
          400: '#b5a886',
          500: '#8a8068',
          600: '#6e654d',
          700: '#544c39',
          800: '#3a3528',
          900: '#2a2519',
          950: '#1a1a1a',
        },
        content: {
          background: '#ffffff',
          borderColor: '#1a1a1a',
        },
        text: {
          color: '#1a1a1a',
          mutedColor: '#6b6b6b',
        },
        formField: {
          background: '#ffffff',
          color: '#1a1a1a',
          borderColor: '#1a1a1a',
          hoverBorderColor: '#1a1a1a',
          focusBorderColor: '#e0b324',
          placeholderColor: '#6b6b6b',
        },
      },
      dark: {
        primary: {
          color: '#7a5ce0',
          contrastColor: '#ffffff',
          hoverColor: '#8a6cf0',
          activeColor: '#6a4ccc',
        },
        surface: {
          0: '#ffffff',
          50: '#efeaff',
          100: '#d8d0ec',
          200: '#b5a9d9',
          300: '#9d93cf',
          400: '#6f6790',
          500: '#4d4470',
          600: '#3a3158',
          700: '#2a2348',
          800: '#241c42',
          900: '#1f1838',
          950: '#181230',
        },
        content: {
          background: '#2a2348',
          borderColor: '#efeaff',
        },
        text: {
          color: '#efeaff',
          mutedColor: '#b8aee6',
        },
        formField: {
          background: '#221c3c',
          color: '#efeaff',
          borderColor: '#efeaff',
          hoverBorderColor: '#efeaff',
          focusBorderColor: '#7a5ce0',
          placeholderColor: '#b8aee6',
        },
      },
    },
  },
})
