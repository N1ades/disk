<template>
  <v-container>
    <v-card class="mx-auto" max-width="800px">
      <v-card-title class="text-h5">
        File Uploader
      </v-card-title>

      <!-- Drop Area Zone and File Selection -->
      <v-card-text>


        <v-sheet class="d-flex flex-column align-center justify-center pa-6 mb-6" height="200" rounded border
          :color="isDragging ? 'primary' : ''" style="border-style: dashed; cursor: pointer; position: relative"
          @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="onDrop"
          @click="$refs.fileInput.click()">
          <v-progress-linear :model-value="45" color="grey-darken-3"
            :style="{ position: 'absolute', width: '100%', top: 0, left: 0, height: '100%', }"></v-progress-linear>


          <v-icon :style="{ position: 'relative' }" size="64" color="grey">mdi-cloud-upload-outline</v-icon>
          <div :style="{ position: 'relative' }" class="text-body-1 mt-4">
            Drag and drop files here or click to select files
          </div>
          <input :style="{ position: 'relative' }" ref="fileInput" type="file" multiple @change="onFileSelected"
            class="d-none" />

        </v-sheet>

        <div class="d-flex" :style="{ position: 'relative' }">
          <v-btn class="me-4" prepend-icon="mdi-folder-open" @click="$refs.folderInput.click()">
            Select Folder
          </v-btn>
          <input ref="folderInput" type="file" webkitdirectory directory multiple @change="onFolderSelected"
            class="d-none" />

          <v-btn color="error" prepend-icon="mdi-delete" @click="clearFiles" :disabled="files.length === 0">
            Clear All
          </v-btn>
        </div>
      </v-card-text>

      <!-- Virtual Scroll with Items -->
      <v-card-text v-if="files.length > 0">
        <div class="text-h6 mb-2">Files ({{ files.length }})</div>
        <v-virtual-scroll :items="files" height="400" item-height="70">
          <template v-slot:default="{ item }">
            <v-card class="mb-2"
              :style="{ position: 'relative', overflow: 'hidden', marginLeft: `${item.depth * 32}px` }">
              <!-- Progress Bar as Background -->
              <v-progress-linear :model-value="item.progress" color="grey-darken-3"
                :style="{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }"></v-progress-linear>

              <div class="d-flex align-center pa-4" style="position: relative; z-index: 1">
                <v-avatar class="me-4" :color="getFileColor(item.file.name)" size="40">
                  <v-icon dark>{{ getFileIcon(item.file.name) }}</v-icon>
                </v-avatar>

                <div class="flex-grow-1">
                  <div class="text-subtitle-1 text-truncate">
                    {{ item.file.name }}
                  </div>
                  <div class="text-caption">
                    {{ formatFileSize(item.file.size) }} • {{ item.progress }}% complete
                  </div>
                </div>

                <div>
                  <v-btn size="small" icon variant="text" @click="copyLink(item)">
                    <v-icon>mdi-link-variant</v-icon>
                    <v-tooltip activator="parent" location="top">Copy Link</v-tooltip>
                  </v-btn>

                  <v-btn size="small" icon variant="text" color="error" @click="removeFile(item)">
                    <v-icon>mdi-close</v-icon>
                    <v-tooltip activator="parent" location="top">Remove</v-tooltip>
                  </v-btn>
                </div>
              </div>
            </v-card>
          </template>
        </v-virtual-scroll>
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
import { TransferManager } from "./utils/transfermanager.ts";

export default {
  data() {
    return {
      files: [],
      isDragging: false,
      snackbar: false,
      snackbarText: '',
    }
  },
  beforeMount() {
    console.log('meeme');

    this.transferManager = new TransferManager();

  },
  beforeUnmount() {
    this.transferManager.destroy()
  },
  
  methods: {
    onDrop(event) {
      this.isDragging = false
      const newFiles = Array.from(event.dataTransfer.files)
      this.addFiles(newFiles)
    },

    onFileSelected(event) {
      // const newFiles = Array.from(event.target.files)
      this.transferManager.fileManager.fileChangeEventHandler(event);
      event.target.value = null // Reset input to allow selecting the same file again
    },

    onFolderSelected(event) {
      // const newFiles = Array.from(event.target.files)
      this.transferManager.fileManager.fileChangeEventHandler(event);
      // this.transferManager.addFiles(event);
      event.target.value = null // Reset input
    },

    // addFiles(newFiles) {

    //   const filesToAdd = newFiles.map(file => ({
    //     id: Math.random().toString(36).substring(2, 15),
    //     file: file,
    //     progress: Math.floor(Math.random() * 100), // Simulating progress
    //     link: URL.createObjectURL(file)
    //   }))

    //   this.files = [...this.files, ...filesToAdd]
    //   this.showSnackbar(`Added ${filesToAdd.length} file(s)`)
    // },

    removeFile(item) {
      this.transferManager.removeFile(item);

      // const index = this.files.findIndex(f => f.id === item.id)
      // if (index !== -1) {
      //   // Revoke object URL to prevent memory leaks
      //   URL.revokeObjectURL(item.link)
      //   this.files.splice(index, 1)
      //   this.showSnackbar('File removed')
      // }
    },

    clearFiles() {
      this.transferManager.clearFiles();
      // Clean up object URLs
      // this.files.forEach(item => {
      //   URL.revokeObjectURL(item.link)
      // })
      // this.files = []
      // this.showSnackbar('All files cleared')
    },

    copyLink(item) {
      navigator.clipboard.writeText(item.link)
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

    getFileIcon(filename) {
      const extension = filename.split('.').pop().toLowerCase()

      const iconMap = {
        pdf: 'mdi-file-pdf-box',
        doc: 'mdi-file-word',
        docx: 'mdi-file-word',
        xls: 'mdi-file-excel',
        xlsx: 'mdi-file-excel',
        ppt: 'mdi-file-powerpoint',
        pptx: 'mdi-file-powerpoint',
        jpg: 'mdi-file-image',
        jpeg: 'mdi-file-image',
        png: 'mdi-file-image',
        gif: 'mdi-file-gif-box',
        mp3: 'mdi-file-music',
        mp4: 'mdi-file-video',
        zip: 'mdi-zip-box',
        rar: 'mdi-zip-box',
        txt: 'mdi-file-document',
        js: 'mdi-language-javascript',
        html: 'mdi-language-html5',
        css: 'mdi-language-css3',
        json: 'mdi-code-json',
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