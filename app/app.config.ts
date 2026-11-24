export default defineAppConfig({
  ui: {
    colors: {
      primary: 'teal',
      neutral: 'zinc',
    },
    button: {
      slots: {
        base: 'whitespace-nowrap active:scale-[0.985] transition-transform',
      },
    },
    card: {
      defaultVariants: {
        variant: 'outline',
      },
    },
  },
})
