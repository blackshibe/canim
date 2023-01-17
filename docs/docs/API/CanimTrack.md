# CanimTrack

The class used for tracks in the library. It shares many similiarities with CanimTrack, however canim avoids inheritance.

## Methods

---

### CanimTrack.load_sequence

```ts
CanimTrack.load_sequence(id: string | KeyframeSequence): void
```

Loads the AnimationTrack for the track. Does not yield and fires finished_loading when it's finished.

!!! caution
Canim calls this automatically. There is no reason to do it yourself.

## Events

---

### CanimTrack.keyframe_reached

```ts
CanimTrack.keyframe_reached: Signal
```

Fires when a named keyframe is stepped over by the animator.

---

### CanimTrack.finished_loading

```ts
CanimTrack.finished_loading: Signal
```

Fires when the animation finishes loading.

!!! caution
This overwrites the looped property of the pose, so set it after the track finishes loading if you are overwriting it.

---

### CanimTrack.started

```ts
CanimTrack.started: Signal
```

Fires when the animation starts.

---

### CanimTrack.finished

```ts
CanimTrack.finished: Signal
```

Fires when the animation ends.

## Properties

---

### CanimTrack.sequence

```ts
CanimTrack.sequence?: customKeyframe
```

Contains animation data that Canim interprets. You can edit this to change the animation data.
nil if the animation is unloaded.

---

### CanimTrack.bone_weights

```ts
CanimTrack.bone_weights: { [index: string]: number | undefined } = {};
```

Controls how much individual axis of individual Motor6D Transforms are affected by this animation. <br/>
you can use `__CANIM_DEFAULT_BONE_WEIGHT` for the index to affect all bones:

```ts
animation.bone_weights.__CANIM_DEFAULT_BONE_WEIGHT = [
	// x y z
	[1, 1, 1],
	// rx ry rz
	[1, 1, 0.1],
];
```

!!! note
this property is additionally multiplied by CanimTrack.weight.

---

### CanimTrack.name

```ts
CanimTrack.name: string
```

Name of the track.

---

### CanimTrack.priority

```ts
CanimTrack.priority: number
```

Priority of the track.

---

### CanimTrack.fading

```ts
CanimTrack.fading: boolean
```

Whether the track is fading out.

---

### CanimTrack.fade_time

```ts
CanimTrack.fade_time: number
```

Controls how quickly the track fades out after stopping.

---

### CanimTrack.loaded

```ts
CanimTrack.loaded: boolean
```

Whether the track is loaded.

---

### CanimTrack.stopping

```ts
CanimTrack.stopping: boolean
```

If true, the track will stop playing at the next `Canim.update` call.

---

### CanimTrack.playing

```ts
CanimTrack.playing: boolean
```

Whether the track is playing.

---

### CanimTrack.speed

```ts
CanimTrack.speed: number
```

Speed of the track. deltatime from `Canim.update()` is multiplied by this function.

---

### CanimTrack.time

```ts
CanimTrack.time: number
```

How long the animation has played for.

---

### CanimTrack.length

```ts
CanimTrack.length: number
```

How long the track is, in seconds.

---

### CanimTrack.looped

```ts
CanimTrack.looped: number
```

Controls whether the track will automatically restart once it reaches the end.

---

### CanimTrack.rebase_target

```ts
CanimTrack.rebase_target?: CanimTrack
```

Rebase target for the animation.
TODO: better documentation

---

### CanimTrack.rebase_basis

```ts
CanimTrack.rebase_basis?: CanimTrack
```

Rebase basis for the animation.
TODO: better documentation

---

### CanimTrack.sequence

```ts
CanimTrack.sequence?: customKeyframeSequence
```

Animation data used by the animator.

---

### CanimTrack.transition_disable

```ts
CanimTrack.transition_disable: { [index: string]: boolean }
```

If a Motor6D name is included in this table, transitions will not play for it.

---

### CanimTrack.transition_disable_all

```ts
CanimTrack.transition_disable_all: boolean
```

Controls whether transitions are disabled for this track.
