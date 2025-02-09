// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.
import {$} from './util.js';
import {config} from './config.js';
import {LoaderSource, CDImageSource, FileSource, ZipSource, NoGamedataError} from './loadersource.js';
import {addToast} from './widgets.js';
import * as midiPlayer from './midi.js';
import * as volumeControl from './volume.js';

let imageFile: File | undefined;
let metadataFile: File | undefined;
let source: LoaderSource | null = null;
let installing = false;

function init() {
    $('#fileselect').addEventListener('change', handleFileSelect, false);
    document.body.ondragover = handleDragOver;
    document.body.ondrop = handleDrop;
}

export function getCDDA(track: number): Promise<Blob> {
    return source!.getCDDA(track);
}

export function reloadImage(): Promise<any> {
    return source!.reloadImage();
}

function handleFileSelect(evt: Event) {
    let input = <HTMLInputElement>evt.target;
    handleFiles(input.files!);
    input.value = '';
}

function handleDragOver(evt: DragEvent) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer!.dropEffect = 'copy';
}

function handleDrop(evt: DragEvent) {
    evt.stopPropagation();
    evt.preventDefault();
    handleFiles(evt.dataTransfer!.files);
}

async function handleFiles(files: FileList) {
    if (installing || files.length === 0)
        return;

    let hasALD = false;
    let recognized = false;
    for (let file of files) {
        if (isImageFile(file)) {
            imageFile = file;
            $('#imgReady').classList.remove('notready');
            $('#imgReady').textContent = file.name;
            recognized = true;
        } else if (isMetadataFile(file)) {
            metadataFile = file;
            $('#cueReady').classList.remove('notready');
            $('#cueReady').textContent = file.name;
            recognized = true;
        } else if (file.name.toLowerCase().endsWith('.ald')) {
            hasALD = true;
        } else if (file.name.toLowerCase().endsWith('.rar')) {
            addToast('展開前のrarファイルは読み込めません。', 'warning');
            recognized = true;
        }
    }

    if (imageFile && (metadataFile || imageFile.name.toLowerCase().endsWith('.iso'))) {
        source = new CDImageSource(imageFile, metadataFile);
    } else if (!imageFile && !metadataFile) {
        if (files.length == 1 && files[0].name.toLowerCase().endsWith('.zip')) {
            source = new ZipSource(files[0]);
        } else if (hasALD) {
            source = new FileSource(files);
        }
    }

    if (!source) {
        if (!recognized)
            addToast(files[0].name + ' は認識できない形式です。', 'warning');
        return;
    }

    installing = true;
    try {
        await source.startLoad();
        loaded(source.hasMidi);
    } catch (err) {
        if (err instanceof NoGamedataError) {
            ga('send', 'event', 'Loader', 'NoGamedata', err.message);
            addToast('インストールできません。' + err.message, 'warning');
        } else {
            ga('send', 'event', 'Loader', 'LoadFailed', err.message);
            addToast('インストールできません。認識できない形式です。', 'warning');
        }
        source = null;
    }
    installing = false;
}

function isImageFile(file: File): boolean {
    let name = file.name.toLowerCase();
    return name.endsWith('.img') || name.endsWith('.mdf') || name.endsWith('.iso');
}

function isMetadataFile(file: File): boolean {
    let name = file.name.toLowerCase();
    return name.endsWith('.cue') || name.endsWith('.ccd') || name.endsWith('.mds');
}

function loaded(hasMidi: boolean) {
    if (hasMidi)
        midiPlayer.init(volumeControl.audioNode());
    $('#xsystem35').hidden = false;
    document.body.classList.add('game');
    $('#toolbar').classList.remove('before-game-start');
    window.onbeforeunload = onBeforeUnload;
    setTimeout(() => {
        if (config.antialias)
            Module.arguments.push('-antialias');
        Module.removeRunDependency('gameFiles');
    }, 0);
}

function onBeforeUnload(e: BeforeUnloadEvent) {
    if (config.unloadConfirmation) {
        e.returnValue = 'セーブしていないデータは失われます。';
        volumeControl.suspendForModalDialog();
    }
}

init();
