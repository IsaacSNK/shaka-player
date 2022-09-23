
    /**
     * Interface for UI elements.  UI elements should inherit from the concrete base
     * class shaka.ui.Element.  The members defined in this extern's constructor are
     * all available from the base class, and are defined here to keep the compiler
     * from renaming them.
     */
  export interface IUIElement extends shaka.util.IReleasable {
    ad : shaka.extern.IAd | null ;
    adManager : shaka.extern.IAdManager | null ;
    controls : shaka.ui.Controls | null ;
    eventManager : shaka.util.EventManager | null ;
    localization : shaka.ui.Localization | null ;
    parent : HTMLElement | null ;
    player : shaka.Player | null ;
    video : HTMLMediaElement | null ;
        release ( ) : any ;
}
  
    /**
     * A factory for creating a UI element.
     */
    export interface Factory {
      create (rootElement : HTMLElement , controls : shaka.ui.Controls ) : shaka.extern.IUIElement ;
    }
  
    /**
     * Interface for UI range elements.  UI range elements should inherit from the
     * concrete base class shaka.ui.RangeElement.  The members defined in this
     * extern's constructor are all available from the base class, and are defined
     * here to keep the compiler from renaming them.
     */
    export interface IUIRangeElement extends shaka.extern.IUIElement {
        bar : HTMLInputElement ;
        container : HTMLElement ;
        changeTo (value : number ) : any ;
        getValue ( ) : number ;
        /**
         * Called when a new value is set by user interaction.
         * To be overridden by subclasses.
         */
        onChange ( ) : any ;
        /**
         * Called when user interaction ends.
         * To be overridden by subclasses.
         */
        onChangeEnd ( ) : any ;
        /**
         * Called when user interaction begins.
         * To be overridden by subclasses.
         */
        onChangeStart ( ) : any ;
        setRange (min : number , max : number ) : any ;
        setValue (value : number ) : any ;
  }

    /**
     * Interface for SeekBars. SeekBars should inherit from the concrete base
     * class shaka.ui.Element. If you do not need to totaly rebuild the
     * SeekBar, you should consider using shaka.ui.RangeElement or
     * shaka.ui.SeekBar as your base class.
     */
    export interface IUISeekBar extends shaka.extern.IUIRangeElement {
      getValue ( ) : number ;
      isShowing ( ) : boolean ;
      setValue (value : number ) : any ;
      /**
       * Called by Controls on a timer to update the state of the seek bar.
       * Also called internally when the user interacts with the input element.
       */
      update ( ) : any ;
    }
  
    /**
     * A factory for creating a SeekBar element.
     */
    export interface Factory {
      create (rootElement : HTMLElement , controls : shaka.ui.Controls ) : shaka.extern.IUISeekBar ;
    }
  
    /**
     * Interface for UI settings menus.  UI settings menus should inherit from the
     * concrete base class shaka.ui.SettingsMenu.  The members defined in this
     * extern's constructor are all available from the base class, and are defined
     * here to keep the compiler from renaming them.
     */
    export interface IUISettingsMenu extends shaka.extern.IUIElement {
        backButton : HTMLButtonElement ;
        backSpan : HTMLElement ;
        button : HTMLButtonElement ;
        currentSelection : HTMLElement ;
        icon : HTMLElement ;
        menu : HTMLElement ;
        nameSpan : HTMLElement ;
    }
  
  export type UIConfiguration = { addBigPlayButton : boolean , addSeekBar : boolean , castAndroidReceiverCompatible : boolean , castReceiverAppId : string , clearBufferOnQualityChange : boolean , contextMenuElements : string [] , controlPanelElements : string [] , customContextMenu : boolean , doubleClickForFullscreen : boolean , enableFullscreenOnRotation : boolean , enableKeyboardPlaybackControls : boolean , enableTooltips : boolean , fadeDelay : number , fastForwardRates : number [] , forceLandscapeOnFullscreen : boolean , keyboardSeekDistance : number , overflowMenuButtons : string [] , playbackRates : number [] , rewindRates : number [] , seekBarColors : shaka.extern.UISeekBarColors , showUnbufferedStart : boolean , singleClickForPlayAndPause : boolean , statisticsList : string [] , trackLabelFormat : shaka.ui.Overlay.TrackLabelFormat , volumeBarColors : shaka.extern.UIVolumeBarColors } ;


  export type UISeekBarColors = { adBreaks : string , base : string , buffered : string , played : string } ;
  

  export type UIVolumeBarColors = { base : string , level : string } ;
  
  