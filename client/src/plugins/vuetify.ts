/**
 * plugins/vuetify.ts
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Styles
// import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

import {
  mdiCloudUploadOutline,
  mdiDelete,
  mdiFolderOpen,
  mdiCast,
  mdiLinkVariant,
  mdiClose,
  mdiFilePdfBox,
  mdiFileWord,
  mdiFileExcel,
  mdiFilePowerpoint,
  mdiFileImage,
  mdiFileGifBox,
  mdiFileMusic,
  mdiFileVideo,
  mdiZipBox,
  mdiFileDocument,
  mdiLanguageJavascript,
  mdiLanguageHtml5,
  mdiLanguageCss3,
  mdiCodeJson
} from '@mdi/js'

// Composables
import { createVuetify } from 'vuetify'

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases: {
      ...aliases,
      mdiCloudUploadOutline,
      mdiDelete,
      mdiFolderOpen,
      mdiCast,
      mdiLinkVariant,
      mdiClose,
      mdiFilePdfBox,
      mdiFileWord,
      mdiFileExcel,
      mdiFilePowerpoint,
      mdiFileImage,
      mdiFileGifBox,
      mdiFileMusic,
      mdiFileVideo,
      mdiZipBox,
      mdiFileDocument,
      mdiLanguageJavascript,
      mdiLanguageHtml5,
      mdiLanguageCss3,
      mdiCodeJson
    },
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'dark',

  },
})
