<template>
  <v-container max-width="100%" min-height="100vh" style="display: grid">
    <v-card class="mx-auto" max-width="100%" height="100%" width="100%" min-height="100%"
      style="display:grid; grid-template-rows: auto auto 1fr;">
      <div style="display: flex; justify-content: space-between;  align-items: center;">

        <v-card-title class="text-h5">
          Realtime File Sharing
        </v-card-title>

        <v-card-title style="font-size: 1.2rem; font-weight: normal; ">
          <span  v-if="connected">🟢 Online</span>
          <span v-else>🟡 Connecting<span class="dots"></span></span>
          
        </v-card-title>
      </div>

      <v-card-text>

        <v-sheet class="d-flex flex-column align-center justify-center pa-6 mb-6" height="200" rounded border
          :color="isDragging ? 'primary' : ''" style="border-style: dashed; cursor: pointer; position: relative"
          @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="onDrop"
          @click="$refs.fileInput.click()">
          <v-progress-linear v-if="dropProgress" :model-value="dropProgress * 100" color="grey-darken-3"
            :style="{ position: 'absolute', width: '100%', top: 0, left: 0, height: '100%', }"></v-progress-linear>


          <v-icon :style="{ position: 'relative' }" size="64" color="grey">$mdiCloudUploadOutline</v-icon>
          <div :style="{ position: 'relative' }" class="text-body-1 mt-4">
            <span v-if="dropProgress">Reading files metadata {{ `${Math.round(dropProgress * 100)}%` }}</span>
            <span v-else>Drag and drop files here or click to select files</span>
          </div>
          <input :style="{ position: 'relative' }" ref="fileInput" type="file" multiple @change="onFileSelected"
            class="d-none" />

        </v-sheet>

        <div class="d-flex" :style="{ position: 'relative' }">
          <v-btn class="me-4" prepend-icon="$mdiFolderOpen" @click="$refs.folderInput.click()">
            Select Folder
          </v-btn>
          <input ref="folderInput" type="file" webkitdirectory directory multiple @change="onFolderSelected"
            class="d-none" />

          <v-btn color="error" prepend-icon="$mdiDelete" @click="clearFiles" :disabled="files.length === 0">
            Clear All
          </v-btn>

            <a style="margin-left: auto;" href="https://cast.nyades.dev" target="_blank">
              <v-btn prepend-icon="$mdiCast">
              Share Screen And Sound
              </v-btn>
            </a>
        </div>
      </v-card-text>

      <!-- Virtual Scroll with Items -->
      <v-card-text v-if="files.length" style="display:grid; grid-template-rows: auto 1fr;">
        <div class="text-h6 mb-2">Files ({{ files.length }})</div>
        <div style="position:relative;">
          <v-virtual-scroll :items="files" width="100%" height="100%" max-height="100%" item-height="70"
            style="position:absolute; ">
            <template v-slot:default="{ item }">
              <v-card class="mb-2"
                :style="{ position: 'relative', overflow: 'hidden', marginLeft: `${item.depth * 32}px` }">
                <v-progress-linear :model-value="Math.round(item.progress / (item.count || 1))" color="grey-darken-3"
                  :style="{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }"></v-progress-linear>

                <div class="d-flex align-center pa-4" style="position: relative; z-index: 1">
                  <v-avatar class="me-4" :color="getFileColor(item.path)" size="40">
                    <v-icon dark>{{ getFileIcon(item) }}</v-icon>
                  </v-avatar>

                  <div class="flex-grow-1">
                    <div class="text-subtitle-1 text-truncate">
                      {{ item.path.split('/').pop() }}
                    </div>
                    <div class="text-caption">

                      {{ formatFileSize(item.size) }} • <span v-if="item.count">{{ item.count }} files •</span> {{
                        Math.round(item.progress / (item.count || 1)) }}% transfered
                    </div>
                  </div>

                  <div>
                    <v-btn size="small" icon variant="text" :disabled="item.isFolder" @click="copyLink(item)">
                      <v-icon>$mdiLinkVariant</v-icon>
                      <v-tooltip activator="parent" location="top">Copy Link</v-tooltip>
                    </v-btn>

                    <v-btn size="small" icon variant="text" color="error" @click="removeFile(item)">
                      <v-icon>$mdiClose</v-icon>
                      <v-tooltip activator="parent" location="top">Remove</v-tooltip>
                    </v-btn>
                  </div>
                </div>
              </v-card>
            </template>
          </v-virtual-scroll>
        </div>

      </v-card-text>

      <v-card-text v-else class="text-center text-subtitle-1 text-grey">
        No files selected
      </v-card-text>
    </v-card>

    <!-- Snackbar for notifications -->
    <v-snackbar v-model="snackbar" :timeout="2000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script>
import { BackgroundAudioKeeper } from "./utils/backgroundAudioKeeper.ts";
import { TransferManager } from "./utils/transfermanager.ts";
import NoSleep from '@zakj/no-sleep';

export default {
  data() {
    return {
      files: [],
      isDragging: false,
      snackbar: false,
      snackbarText: '',
      dropProgress: 0,
      openFoldersMap: new Map(),
      wakeLockEnabled: false,
      connected: false,
    }
  },
  beforeMount() {
    this.transferManager = new TransferManager();
    this.transferManager.files = this.files;
    this.transferManager.addEventListener('change', this.filesChanged)
    this.noSleep = new NoSleep();
    // this.backgroundAudioKeeper = new BackgroundAudioKeeper();

    let connectionTimeout;

    this.transferManager.ws.addEventListener('open', (status) => {

      connectionTimeout = setTimeout(() => {
        this.connected = true;
      }, 1300)
    })
    this.transferManager.ws.addEventListener('reconect', (status) => {
      this.connected = false;
      clearTimeout(connectionTimeout);
    })
  },
  beforeUnmount() {
    this.wakeLockSwitch(false);
    this.transferManager.destroy();
    // this.backgroundAudioKeeper.destroy();



  },

  methods: {
    wakeLockSwitch(enable) {
      if (!this.wakeLockEnabled && enable) {
        this.noSleep.enable();
        // this.backgroundAudioKeeper.start();
        console.log('wakeLock enable');

      }
      if (this.wakeLockEnabled && !enable) {
        this.noSleep.disable();
        // this.backgroundAudioKeeper.stop();
        console.log('wakeLock disable');
      }
      this.wakeLockEnabled = enable;
    },
    filesChanged(files) {
      const folderMap = new Map();
      for (const item of files) {
        const folders = item.path.split('/');
        if (folders.length <= 1) {
          continue;
        }
        folders.length = folders.length - 1;

        let path = '';
        let depth = 0;
        for (const folder of folders) {
          path += `${folder}`

          let exists = folderMap.get(path);
          if (!exists) {
            exists = { size: 0, path, depth, progress: 0, count: 0 }
            folderMap.set(path, exists);
          }
          exists.size += item.size;
          exists.progress += item.progress;
          exists.count++;
          depth += 1;
          path += `/`;
        }
        item.depth = depth;
      }

      const folderObjects = Array.from(folderMap.values()).map(folder => {
        return {
          path: folder.path,
          progress: folder.progress,
          isFolder: true,
          depth: folder.depth,
          count: folder.count,
          size: folder.size,
        }
      })

      this.files = [...folderObjects, ...files].toSorted((a, b) => a.path.depth - b.path.depth || b.isFolder - a.isFolder || a.path.localeCompare(b.path));

      if (this.files.length === 0) {
        this.wakeLockSwitch(false);
      }
    },

    async onDrop(event) {
      this.wakeLockSwitch(true);
      this.isDragging = false
      await this.transferManager.fileManager.dropzoneEventHandler(event, (progress) => { this.dropProgress = progress });
      this.dropProgress = 0;
    },

    async onFileSelected(event) {
      this.wakeLockSwitch(true);
      await this.transferManager.fileManager.fileChangeEventHandler(event, (progress) => { this.dropProgress = progress });
      this.dropProgress = 0;
    },

    async onFolderSelected(event) {
      this.wakeLockSwitch(true);
      await this.transferManager.fileManager.fileChangeEventHandler(event, (progress) => { this.dropProgress = progress });
      this.dropProgress = 0;
    },

    removeFile(item) {
      this.transferManager.removeFile(item.path);
    },

    clearFiles() {
      this.transferManager.clearFiles();
    },

    copyLink(item) {
      this.wakeLockSwitch(true);
      const url = encodeURI(location.protocol + '//' + location.host + '/' + item.link);
      navigator.clipboard.writeText(url)
        .then(() => {
          this.showSnackbar('Link copied to clipboard')
        })
        .catch(err => {
          console.error('Could not copy link:', err)
          this.showSnackbar('Failed to copy link')
        })
    },

    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes'

      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },

    getFileIcon(item) {
      if (item.isFolder) {
        return '$mdiFolderOpen';
      }

      const extension = item.path.split('.').pop().toLowerCase()

      const iconMap = {
        folder: '$mdiFolderOpen',
        pdf: '$mdiFilePdfBox',
        doc: '$mdiFileWord',
        docx: '$mdiFileWord',
        xls: '$mdiFileExcel',
        xlsx: '$mdiFileExcel',
        ppt: '$mdiFilePowerpoint',
        pptx: '$mdiFilePowerpoint',
        jpg: '$mdiFileImage',
        jpeg: '$mdiFileImage',
        png: '$mdiFileImage',
        gif: '$mdiFileGifBox',
        mp3: '$mdiFileMusic',
        mp4: '$mdiFileVideo',
        zip: '$mdiZipBox',
        rar: '$mdiZipBox',
        txt: '$mdiFileDocument',
        js: '$mdiLanguageJavascript',
        html: '$mdiLanguageHtml5',
        css: '$mdiLanguageCss3',
        json: '$mdiCodeJson',
      }

      return iconMap[extension] || 'mdi-file'
    },

    getFileColor(filename) {
      const extension = filename.split('.').pop().toLowerCase()

      const colorMap = {
        pdf: 'red',
        doc: 'blue',
        docx: 'blue',
        xls: 'green',
        xlsx: 'green',
        ppt: 'orange',
        pptx: 'orange',
        jpg: 'purple',
        jpeg: 'purple',
        png: 'purple',
        gif: 'purple',
        mp3: 'pink',
        mp4: 'deep-purple',
        zip: 'brown',
        rar: 'brown',
        txt: 'grey',
        js: 'amber',
        html: 'deep-orange',
        css: 'blue',
        json: 'teal',
      }

      return colorMap[extension] || 'grey-darken-1'
    },

    showSnackbar(text) {
      this.snackbarText = text
      this.snackbar = true
    }

  },

}
</script>