// Сгенерировано tools/prep_sfx.js из art/incoming/audio/sfx (ElevenLabs Sound Effects, промпты — docs/SFX.md). Не редактировать вручную.
// f — файлы-варианты (чередуются), dur — длина каждого (с), loop — зацикленный звук (шов запечён в файле), gain — громкость каждого файла относительно нормализованного (0…1).
window.ALE_SFX = { base: 'assets/audio/sfx/', sounds: {
    stomp: { f: ["stomp_1.wav"], dur: [1.385], gain: [0.224] },
    throw: { f: ["throw_1.wav", "throw_2.wav"], dur: [0.199, 0.167], gain: [0.243, 0.321] },
    throw_chalk: { f: ["throw_chalk_1.wav"], dur: [0.143], gain: [0.152] },
    throw_paper: { f: ["throw_paper_1.wav"], dur: [0.193], gain: [0.15] },
    barrel_kick: { f: ["barrel_kick_1.wav"], dur: [0.5], gain: [0.345] },
    barrel_smash: { f: ["barrel_smash_1.wav"], dur: [0.45], gain: [0.247] },
    barrel_roll: { f: ["barrel_roll_1.wav"], dur: [4], loop: true, gain: [0.221] },
    horse_munch: { f: ["horse_munch_1.wav"], dur: [0.92], gain: [0.41] }
} };
