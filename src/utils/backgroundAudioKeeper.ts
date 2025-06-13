export class BackgroundAudioKeeper {
    // constructor(audioSrc = '/5-seconds-of-silence.mp3') {
    constructor(audioSrc = '/flying-away-space-ambient-inspiration-335153.mp3') {
        this.audio = new Audio(audioSrc);
        this.audio.loop = true;
        this.audio.preload = 'auto';
        this.audio.controls = false;
        this.audio.style = 'display: none;';
        this.audio.volume = 0.001; // Almost muted
        this.audio.setAttribute('playsinline', 'true'); // required for iOS
        document.body.appendChild(this.audio);
    }

    async start() {
        try {
            await this.audio.play();
            console.log('[BackgroundAudioKeeper] Audio playback started.');
        } catch (e) {
            console.warn('[BackgroundAudioKeeper] Audio playback failed:', e);
        }
    }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        console.log('[BackgroundAudioKeeper] Audio playback stopped.');
    }

    destroy() {
        this.stop();
        if (this.audio.parentElement) {
            this.audio.parentElement.removeChild(this.audio);
        }
        console.log('[BackgroundAudioKeeper] Audio element removed.');
    }
}
