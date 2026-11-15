import { registerRoot } from "remotion";
import { ensureFontsLoaded } from "./fonts";
import { RemotionRoot } from "./Root";

// Fonts are requested before the first composition mounts and block every frame until ready.
ensureFontsLoaded();
registerRoot(RemotionRoot);
