import path from "node:path";

/**
 * The on-disk layout of the project and of each video. Every path the studio reads or
 * writes is derived here, so nothing else hardcodes a directory name.
 */
export class Workspace {
  readonly projectRoot: string;
  readonly outputRoot: string;

  constructor(projectRoot: string, outputDirectory: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.outputRoot = path.resolve(this.projectRoot, outputDirectory);
  }

  get brandDir(): string {
    return path.join(this.projectRoot, "brand");
  }
  get musicDir(): string {
    return path.join(this.projectRoot, "assets", "music");
  }
  get templatesDir(): string {
    return path.join(this.projectRoot, "templates");
  }
  get fixtureDir(): string {
    return path.join(this.projectRoot, "fixtures", "synthetic-demo");
  }
  /** Shared, content-addressed cache; safe to delete at any time. */
  get cacheDir(): string {
    return path.join(this.projectRoot, ".cache");
  }
  get narrationCacheDir(): string {
    return path.join(this.cacheDir, "narration");
  }

  video(videoId: string): VideoPaths {
    return new VideoPaths(path.join(this.outputRoot, videoId));
  }
}

export class VideoPaths {
  constructor(readonly root: string) {}

  get manifest(): string {
    return path.join(this.root, "manifest.json");
  }
  get script(): string {
    return path.join(this.root, "script.md");
  }
  get research(): string {
    return path.join(this.root, "research.md");
  }
  get storyboard(): string {
    return path.join(this.root, "storyboard.json");
  }
  get storyboardPreview(): string {
    return path.join(this.root, "storyboard.html");
  }
  get recordings(): string {
    return path.join(this.root, "recordings");
  }
  get audio(): string {
    return path.join(this.root, "audio");
  }
  get scenes(): string {
    return path.join(this.root, "scenes");
  }
  get subtitles(): string {
    return path.join(this.root, "subtitles");
  }
  get thumbnails(): string {
    return path.join(this.root, "thumbnails");
  }
  get final(): string {
    return path.join(this.root, "final");
  }
  get qa(): string {
    return path.join(this.root, "qa");
  }
  get metadata(): string {
    return path.join(this.root, "metadata");
  }
  get exports(): string {
    return path.join(this.root, "export");
  }
  get previews(): string {
    return path.join(this.root, "preview");
  }

  /** Path relative to the video directory, as stored in the manifest. */
  relative(absolute: string): string {
    return path.relative(this.root, absolute).split(path.sep).join("/");
  }
  absolute(relative: string): string {
    return path.join(this.root, ...relative.split("/"));
  }
}
