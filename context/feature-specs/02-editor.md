We need base chrome component that frame every editor screen - the top navbar and the right sidebar shell. These will be reused and extended in every chapter that follows.

### Editor Navbar

Create `components/editor/editor-navbar.tsx`

Requirements:

- fixed-height top navbar
- left center and right sections
- left section contains sidebar toggle button
- use  `PanelLeftOpen` / `PanelLeftClose` icons based on sidebar state
- right section stays empty for now
- dark backgroud with subtle botttom border

### Create Poject sidebar

- sidebar should float above editor canvas
- opening it shoul not push page content
- slides in from the right
- accepts `isOpen` prop
- header with `Projects` title + close button
- shadcn `Tabs`:
    - My Projects
    - Shared
- both tabs show empty placeholder state
- full-width `New Project` button at the botton with `Plus` icon

### Create Dialog Patter

use existing color tokens from `global.css` for dialog styling.

Support:
- title
- description
- footer actions

Do not build actual dialogs yet.


### Check whe  is done

- new components compile witouh Typescrip errors
- no lint errors
- dialog pattern is ready for future use