export default {
  expo: {
    name: "Gol de Ouro",
    slug: "gol-de-ouro",
    scheme: "goldeouro",
    version: "0.1.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    platforms: ["ios", "android", "web"],
    web: {
      bundler: "metro",
      output: "single"
    },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    }
  }
};
