"""Legacy Whisper language detection with bounded, inspectable transcription."""
import math


def confident_language(probabilities):
    ranked = sorted(probabilities.items(), key=lambda pair: -pair[1])
    if not ranked:
        return None
    language, score = ranked[0]
    runner_up = ranked[1][1] if len(ranked) > 1 else 0
    return language if score >= 0.5 and score - runner_up >= 0.2 else None


def timed_segments(segments, duration):
    def timestamp(seconds):
        hundredths = round(seconds * 100)
        minutes, remainder = divmod(hundredths, 6000)
        return f'{minutes}:{remainder / 100:05.2f}'

    rows = []
    previous_start = 0
    for segment in segments:
        text = (segment.get('text') or '').strip()
        if not text:
            continue
        start, end = float(segment['start']), float(segment['end'])
        if (not math.isfinite(start) or not math.isfinite(end) or start < 0
                or start < previous_start or end <= start or start >= duration
                or end > duration + 0.35):
            raise ValueError('Transcript timestamps exceed or contradict the downloaded audio.')
        rows.append({'time': f'{timestamp(start)}-{timestamp(min(end, duration))}', 'voice_over': text})
        previous_start = start
    return rows


def transcribe_audio(path):
    import whisper
    audio = whisper.load_audio(path)
    duration = len(audio) / whisper.audio.SAMPLE_RATE
    # Keep the legacy base detector. Small's automatic detector misidentified
    # the QA devotional clip; a larger decoder alone is not a language fix.
    detector = whisper.load_model('base')
    mel = whisper.log_mel_spectrogram(whisper.pad_or_trim(audio), n_mels=detector.dims.n_mels).to(detector.device)
    _, probabilities = detector.detect_language(mel)
    language = confident_language(probabilities)
    name = 'small' if language else 'base'
    model = whisper.load_model(name) if language else detector
    result = model.transcribe(audio, language=language, fp16=False, verbose=False)
    timeline = timed_segments(result.get('segments') or [], duration)
    text = ' '.join(row['voice_over'] for row in timeline)
    return {
        'text': text, 'timeline': timeline, 'source': f'whisper:{name}',
        'evidence': {'language': result.get('language'), 'language_detector': 'whisper:base',
                     'language_locked': bool(language), 'duration_seconds': duration,
                     'language_candidates': dict(sorted(probabilities.items(), key=lambda pair: -pair[1])[:5])},
    }
