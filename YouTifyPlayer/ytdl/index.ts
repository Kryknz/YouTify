import ytdl, { downloadOptions } from "ytdl-core";
import { opus as Opus, FFmpeg } from "prism-media";
import { Readable, Duplex } from "stream";

interface YTDLStreamOptions extends downloadOptions {
    seek?: number;
    encoderArgs?: string[];
    fmt?: string;
    opusEncoded?: boolean;
};

interface StreamOptions {
    seek?: number;
    encoderArgs?: string[];
    fmt?: string;
    opusEncoded?: boolean;
};

const ytdlEvent = ["info", "progress"];

const forwardEvent = (src: Readable, dest: Readable, event: string | string[]) => {
    dest.on('newListener', (eventName, listener) => {
        if ((Array.isArray(event) && event.includes(eventName)) || event == eventName)
            src.on(eventName, listener)
    });
    dest.on('removeListener', (eventName, listener) => src.removeListener(eventName, listener));
};

/**
  * Create an opus stream for your video with provided encoder args
  * @param url - YouTube URL of the video
  * @param options - YTDL options
  * @example const ytdl = require("discord-ytdl-core");
  * const stream = ytdl("VIDEO_URL", {
  *     seek: 3,
  *     encoderArgs: ["-af", "bass=g=10"],
  *     opusEncoded: true
  * });
  * VoiceConnection.play(stream, {
  *     type: "opus"
  * });
  */
const StreamDownloader = (url: string, options: YTDLStreamOptions) => {
    if (!url) {
        throw new Error("No input url provided");
    }
    if (typeof url !== "string") {
        throw new SyntaxError(`input URL must be a string. Received ${typeof url}!`);
    }

    let FFmpegArgs: string[] = [
        "-analyzeduration", "0",
        "-loglevel", "0",
        "-f", `${options && options.fmt && typeof (options.fmt) == "string" ? options.fmt : "s16le"}`,
        "-ar", "48000",
        "-ac", "2"
    ];

    if (options && options.seek && !isNaN(options.seek)) {
        FFmpegArgs.unshift("-ss", options.seek.toString());
    }

    if (options && options.encoderArgs && Array.isArray(options.encoderArgs)) {
        FFmpegArgs = FFmpegArgs.concat(options.encoderArgs);
    }

    const transcoder = new FFmpeg({
        args: FFmpegArgs
    });

    const inputStream = ytdl(url, options);
    const output = inputStream.pipe(transcoder);
    if (options && !options.opusEncoded) {
        forwardEvent(inputStream, output, ytdlEvent);
        inputStream.on("error", e => output.destroy(e));
        output.on("close", () => transcoder.destroy());
        return output;
    };
    const opus = new Opus.Encoder({
        rate: 48000,
        channels: 2,
        frameSize: 960
    });

    const outputStream = output.pipe(opus);
    forwardEvent(inputStream, outputStream, ytdlEvent);
    inputStream.on("error", (e) => outputStream.destroy(e));
    outputStream.on("close", () => {
        transcoder.destroy();
        opus.destroy();
    });
    return outputStream;
};

/**
  * Create an opus stream for your video with provided encoder args
  * @param info - YTDL full info
  * @param options - YTDL options
  * @example const ytdl = require("discord-ytdl-core");
  * const stream = ytdl(info, {
  *     seek: 3,
  *     encoderArgs: ["-af", "bass=g=10"],
  *     opusEncoded: true
  * });
  * VoiceConnection.play(stream, {
  *     type: "opus"
  * });
  */
const downloadFromInfo = (info: ytdl.videoInfo, options: YTDLStreamOptions) => {
    let FFmpegArgs: string[] = [
        "-analyzeduration", "0",
        "-loglevel", "0",
        "-f", `${options && options.fmt && typeof (options.fmt) == "string" ? options.fmt : "s16le"}`,
        "-ar", "48000",
        "-ac", "2"
    ];

    if (options && options.seek && !isNaN(options.seek)) {
        FFmpegArgs.unshift("-ss", options.seek.toString());
    }

    if (options && options.encoderArgs && Array.isArray(options.encoderArgs)) {
        FFmpegArgs = FFmpegArgs.concat(options.encoderArgs);
    }

    const transcoder = new FFmpeg({
        args: FFmpegArgs
    });

    const inputStream = ytdl.downloadFromInfo(info, options);
    const output = inputStream.pipe(transcoder);
    if (options && !options.opusEncoded) {
        forwardEvent(inputStream, output, ytdlEvent);
        inputStream.on("error", e => output.destroy(e));
        output.on("close", () => transcoder.destroy());
        return output;
    };
    const opus = new Opus.Encoder({
        rate: 48000,
        channels: 2,
        frameSize: 960
    });

    const outputStream = output.pipe(opus);
    forwardEvent(inputStream, outputStream, ytdlEvent);
    inputStream.on("error", (e) => outputStream.destroy(e));
    outputStream.on("close", () => {
        transcoder.destroy();
        opus.destroy();
    });
    return outputStream;
}

/**
 * Creates arbitraryStream
 * @param stream Any readable stream source
 * @param options Stream options
 * @example const streamSource = "https://listen.moe/kpop/opus";
 * let stream = ytdl.arbitraryStream(streamSource, {
 *     encoderArgs: ["-af", "asetrate=44100*1.25"],
 *     fmt: "mp3"
 * });
 * 
 * stream.pipe(fs.createWriteStream("kpop.mp3"));
 */
const arbitraryStream = (stream: string | Readable | Duplex, options: StreamOptions) => {
    if (!stream) {
        throw new Error("No stream source provided");
    }

    let FFmpegArgs: string[];
    if (typeof stream === "string") {
        FFmpegArgs = [
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            "-i", stream,
            "-analyzeduration", "0",
            "-loglevel", "0",
            "-f", `${options && options.fmt && typeof (options.fmt) == "string" ? options.fmt : "s16le"}`,
            "-ar", "48000",
            "-ac", "2"
        ];
    } else {
        FFmpegArgs = [
            "-analyzeduration", "0",
            "-loglevel", "0",
            "-f", `${options && options.fmt && typeof (options.fmt) == "string" ? options.fmt : "s16le"}`,
            "-ar", "48000",
            "-ac", "2"
        ];
    }

    if (options && options.seek && !isNaN(options.seek)) {
        FFmpegArgs.unshift("-ss", options.seek.toString());
    }

    if (options && options.encoderArgs && Array.isArray(options.encoderArgs)) {
        FFmpegArgs = FFmpegArgs.concat(options.encoderArgs);
    }

    let transcoder = new FFmpeg({
        args: FFmpegArgs
    });
    if (typeof stream !== "string") {
        transcoder = stream.pipe(transcoder);
        stream.on("error", e => transcoder.destroy(e));
    }
    if (options && !options.opusEncoded) {
        transcoder.on("close", () => transcoder.destroy());
        return transcoder;
    };
    const opus = new Opus.Encoder({
        rate: 48000,
        channels: 2,
        frameSize: 960
    });

    const outputStream = transcoder.pipe(opus);
    outputStream.on("close", () => {
        transcoder.destroy();
        opus.destroy();
    });
    return outputStream;
};

StreamDownloader.arbitraryStream = arbitraryStream;
const DiscordYTDLCore = Object.assign(StreamDownloader, ytdl);
StreamDownloader.downloadFromInfo = downloadFromInfo;

export = DiscordYTDLCore;