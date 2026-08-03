export interface Preset {
    name: string;
    contentMode: 'glyph' | 'random_digit' | 'random_letter' | 'random_symbol' | 'emoji' | 'shape';
    color: string | string[] | 'rainbow';
    count: number;
    gravity: number;
    speed: number;
    spreadDeg: number;
    lifetimeMs: number;
    glow: boolean;
    explode: boolean;
    emojiSet?: string[];
    symbolSet?: string[];
}

export const PRESETS: Record<string, Preset> = {
    matrix: {
        name: 'Matrix',
        contentMode: 'random_symbol',
        color: '#00ff41',
        count: 4,
        gravity: 80,
        speed: 60,
        spreadDeg: 140,
        lifetimeMs: 600,
        glow: true,
        explode: false,
        symbolSet: ['{', '}', ';', '/', '<', '>', '=', '+', '-', '*', '&', '|', '!', '?'],
    },
    fireworks: {
        name: 'Fireworks',
        contentMode: 'emoji',
        color: 'rainbow',
        count: 8,
        gravity: -40,
        speed: 100,
        spreadDeg: 360,
        lifetimeMs: 800,
        glow: true,
        explode: true,
        emojiSet: ['🎆', '✨', '⭐', '🎇', '💫'],
    },
    typewriter: {
        name: 'Typewriter',
        contentMode: 'glyph',
        color: '#d4a373',
        count: 1,
        gravity: 250,
        speed: 50,
        spreadDeg: 60,
        lifetimeMs: 400,
        glow: false,
        explode: false,
    },
    rainbow: {
        name: 'Rainbow Code',
        contentMode: 'glyph',
        color: 'rainbow',
        count: 3,
        gravity: 150,
        speed: 120,
        spreadDeg: 180,
        lifetimeMs: 500,
        glow: true,
        explode: true,
    },
    minimal: {
        name: 'Minimal',
        contentMode: 'shape',
        color: '#888888',
        count: 2,
        gravity: 400,
        speed: 80,
        spreadDeg: 90,
        lifetimeMs: 300,
        glow: false,
        explode: false,
    },
};

export function getPreset(name: string): Preset | undefined {
    return PRESETS[name];
}
