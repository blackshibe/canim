import Signal from "./lib/Signal";
import Maid from "./lib/Maid";

const RunService = game.GetService("RunService");

const KeyframeSequenceProvider = game.GetService("KeyframeSequenceProvider");
const cached_tracks: { [index: string]: KeyframeSequence | undefined } = {};

declare type signalInfo = {
	played: boolean;
	name: string;
	time: number;
};

declare type transition = {
	start: number;
	finish: number;
	cframe: CFrame;
};

<<<<<<< HEAD
/*
	Reason for the constant type assertion in this module is because animations have a defined structure while 
	typescript thinks otherwise. Performance while keeping type control over the inner workings of this class were needed.
*/
=======
declare type customPose = { name: string; cframe: CFrame; weight: number };
declare type customKeyframe = { name: string; time: number; children: { [index: string]: customPose } };
declare type customKeyframeSequence = { name: string; children: customKeyframe[] };

>>>>>>> 0b3d7fd (Update docs to include complete tutorials, minor changes to structure)
const active_requests: { [index: string]: boolean } = {};
export const cache_get_keyframe_sequence = (id: string): KeyframeSequence => {
	// prevents a race condition
	while (active_requests[id]) RunService.Heartbeat.Wait();

	let sequence = cached_tracks[id];
	if (sequence) return sequence.Clone();

	const [success, fail] = pcall(() => {
		active_requests[id] = true;
		sequence = KeyframeSequenceProvider.GetKeyframeSequenceAsync(id);
		active_requests[id] = false;
	});

	if (!success || !sequence) {
		warn(`GetKeyframeSequenceAsync() failed for id ${id}`);
		warn(fail);

		active_requests[id] = false;

		return cache_get_keyframe_sequence(id);
	}

	// a new call is made to clone the keyframe
	cached_tracks[id] = sequence;
	return cache_get_keyframe_sequence(id);
};
const ease_in_out_quad = (x: number) => (x < 0.5 ? 2 * x * x : 1 - math.pow(-2 * x + 2, 2) / 2);
const map = (value: number, in_min: number, in_max: number, out_min: number, out_max: number) =>
	((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;

const convert_pose_instance = (pose: Pose): customPose => {
	return {
		cframe: pose.CFrame,
		name: pose.Name,
		weight: pose.Weight,
	};
};

const convert_keyframe_instance = (keyframe: Keyframe): customKeyframe => {
	let children: { [index: string]: customPose } = {};

	for (const [_, value] of pairs(keyframe.GetDescendants())) {
		if (value.IsA("Pose") && value.Weight) children[value.Name] = convert_pose_instance(value);
	}

	return {
		name: keyframe.Name,
		time: keyframe.Time,
		children: children,
	};
};

const convert_keyframe_sequence_instance = (sequence: KeyframeSequence): customKeyframeSequence => {
	let children: customKeyframe[] = [];

	for (const [_, value] of pairs(sequence.GetChildren())) {
		if (value.IsA("Keyframe")) children.push(convert_keyframe_instance(value));
	}

	return {
		name: sequence.Name,
		children: children,
	};
};

export class CanimPose {
	keyframe?: customKeyframe;
	keyframe_reached = new Signal<(name: string) => void>();
	finished_loading = new Signal<() => void>();
	started = new Signal<() => void>();
	finished = new Signal<() => void>();

	// unused
	transitions: { [index: string]: transition } = {};
	bone_weights: { [index: string]: number | undefined } = {};

	name = "animation_track";
	loaded = false;
	priority = 0;
	weight = 1;
	time = 0;
	looped = false;
	stopping = false;
	fade_time = 0.5;
	fade_start = tick();

	load_sequence(id: string | KeyframeSequence | Keyframe) {
		task.spawn(() => {
			const sequence = typeIs(id, "Instance") ? id : cache_get_keyframe_sequence(id);

			if (sequence.IsA("Keyframe")) {
				const actual_keyframe = convert_keyframe_instance(sequence);
				this.keyframe = actual_keyframe;
			} else {
				const actual_sequence = convert_keyframe_sequence_instance(sequence);
				this.keyframe = actual_sequence.children[0];
			}

			// a race condition may happen if the event isn't deferred
			task.defer(() => {
				this.loaded = true;
				this.finished_loading.Fire();
			});
		});
	}
}

<<<<<<< HEAD
class CanimTrack {
=======
export class CanimTrack {
>>>>>>> 0b3d7fd (Update docs to include complete tutorials, minor changes to structure)
	sequence?: customKeyframeSequence;
	last_keyframe?: customKeyframe;
	rebase_target?: CanimPose;
	rebase_basis?: CanimPose;
	queued_animation?: CanimTrack;

	transition_disable: { [index: string]: boolean } = {};
	transitions: { [index: string]: transition } = {};
	keyframe_reached = new Signal<(name: string) => void>();
	finished_loading = new Signal<() => void>();
	finished = new Signal<() => void>();
	started = new Signal<() => void>();

	signals: signalInfo[] = [];
	bone_weights: { [index: string]: [[number, number, number], [number, number, number]] | undefined } = {};

	name = "animation_track";

	stopping = false;
	loaded = false;
	priority = 0;
	weight = 1;
	speed = 1;
	time = 0;
	length = 0;
	looped = false;
	fade_time = 0.5;
	transition_disable_all = false;
	playing = false;

	load_sequence(id: string | KeyframeSequence) {
		task.spawn(() => {
			this.signals = [];

			const sequence = typeIs(id, "Instance") ? id : cache_get_keyframe_sequence(id);
			sequence.Name = this.name;

			const actual_sequence = convert_keyframe_sequence_instance(sequence);
			let highest_keyframe: customKeyframe | undefined;

			for (const [_, keyframe] of pairs(actual_sequence.children)) {
				if (keyframe.time > (highest_keyframe?.time || 0)) highest_keyframe = keyframe;
				if (keyframe.name !== "Keyframe") {
					this.signals.push({
						played: false,
						time: keyframe.time,
						name: keyframe.name,
					});
				}

				// idk what this does
				for (const [rawindex, pose] of pairs(keyframe.children)) {
					if (pose.weight === 0) task.defer(() => delete keyframe.children[rawindex]);
				}
			}

			if (!highest_keyframe) return; // warn("KeyframeSequence has no children");

			this.sequence = actual_sequence;
			this.length = highest_keyframe.time;
			// roblox-ts types fucked up, https://developer.roblox.com/en-us/api-reference/property/KeyframeSequence/Loop
			this.looped = (sequence as unknown as { Loop: boolean }).Loop;
			this.last_keyframe = highest_keyframe;

			// a race condition may happen if the event isn't deferred
			task.defer(() => {
				this.loaded = true;
				this.finished_loading.Fire();
			});
		});
	}
}

<<<<<<< HEAD
type transition = {
	start: number;
	finish: number;
	cframe: CFrame;
};

=======
>>>>>>> 0b3d7fd (Update docs to include complete tutorials, minor changes to structure)
export class Canim {
	identified_bones: { [index: string]: Motor6D | undefined } = {};
	playing_animations: CanimTrack[] = [];
	playing_poses: CanimPose[] = [];

	animations: {
		[index: string]: CanimTrack | CanimPose | undefined;
	} = {};

	transitions: {
		[index: string]:
		| Array<{
			start: number;
			finish: number;
			cframe: CFrame;
		}>
		| undefined;
	} = {};

	model?: Model;
	maid = new Maid();
	debug: string[] = [];

	constructor() { }

	assign_model(model: Model) {
		this.model = model;
		this.model.GetDescendants().forEach((element) => {
			if (element.IsA("Motor6D") && element.Part1) {
				this.identified_bones[element.Part1.Name] = element;
			}
		});
	}

	destroy() {
		this.maid.DoCleaning();
		for (const [_, track] of pairs(this.animations)) {
			track.finished_loading.Destroy();
			track.keyframe_reached.Destroy();
			track.started.Destroy();
			track.finished.Destroy();
		}

		for (const [_, value] of pairs(this.identified_bones)) {
			value.Transform = new CFrame();
		}
	}

	load_animation(name: string, priority: number, id: string | KeyframeSequence): CanimTrack {
		const track = new CanimTrack();
		track.name = name;
		track.priority = priority;
		track.load_sequence(id);
		this.animations[name] = track;

		return track;
	}

	load_pose(name: string, priority: number, id: string | KeyframeSequence): CanimPose {
		const track = new CanimPose();
		track.name = name;
		track.priority = priority;
		track.load_sequence(id);
		this.animations[name] = track;

		return track;
	}

	play_animation(id: string) {
		const track = this.animations[id];
		if (!track) return warn("invalid animation: ", id);
		if (track instanceof CanimPose) throw "attempted to play a pose as an playedanimation";

		track.time = 0;
		track.signals.forEach((element) => {
			element.played = false;
		});

		if (!this.playing_animations.includes(track)) {
			this.playing_animations.push(track);
			track.started.Fire();
		}

		return track;
	}

	play_pose(id: string) {
		const track = this.animations[id];
		if (!track) return warn("invalid animation: ", id);

		if (track instanceof CanimTrack) throw "attempted to play a pose as an animation";
		if (!this.playing_poses.includes(track)) {
			this.playing_poses.push(track);
		}
		return track;
	}

	stop_animation(name: string) {
		for (const [_, value] of pairs(this.playing_animations)) {
			if (value.name === name) value.stopping = true;
		}

		for (const [_, value] of pairs(this.playing_poses)) {
			if (value.name === name) value.stopping = true;
		}
	}

	update(delta_time: number) {
		const weight_sum = new Map<Motor6D, [number, CFrame][]>();
		const weight_sum_rebased = new Map<Motor6D, [number, CFrame][]>();
		const bone_totals = new Map<Motor6D, CFrame>();

		const new_playing: CanimTrack[] = [];
		const debug: string[] = [];

		// if this was done inside the first loop the rig would flicker randomly
		for (const [_, track] of pairs(this.playing_animations)) {
			track.time += delta_time * track.speed;

			if (track.time >= track.length || track.time < 0 || track.stopping) {
				for (const [_, element] of pairs(track.signals)) {
					if (track.time >= element.time && !element.played) {
						element.played = true;
						task.spawn(() => {
							track.keyframe_reached.Fire(element.name);
						});
					}
				}

				if (track.looped && !track.stopping) {
					track.playing = false;
					track.finished.Fire();
					for (const [_, element] of pairs(track.signals)) {
						element.played = false;
					}
				} else {
					track.stopping = false;

					// transition to idle once the animation is ready for it
					if (track.last_keyframe) {
						if (track.queued_animation) this.play_animation(track.queued_animation.name);
						track.finished.Fire();

						for (const [_, value] of pairs(track.last_keyframe.children)) {
							this.transitions[value.name] ??= [];
							if (!track.transition_disable[value.name] && !track.transition_disable_all) {
								this.transitions[value.name]!.push({
									start: tick(),
									finish: tick() + track.fade_time,
									cframe: value.cframe,
								});
							}
						}

						continue;
					}
				}
			}

			new_playing.push(track);
		}

		for (const [_, track] of pairs(new_playing)) {
			debug.push(`Track ${track.name} ${track.time}`);
			if (!track.loaded || !track.sequence) continue;
			if (track.time >= track.length && track.looped) track.time %= track.length;

			track.playing = true;

			let first: customKeyframe | undefined = undefined;
			let last: customKeyframe | undefined = undefined;
			for (const [_, keyframe] of pairs(track.sequence.children)) {
				if (keyframe.time >= track.time && !last) last = keyframe;
				else if (keyframe.time <= track.time) first = keyframe;
			}

			if (!first || !last) return warn(`Invalid KeyframeSequence; no start or stop point for ${track.name}`);
			for (const [_, element] of pairs(track.signals)) {
				if (track.time >= element.time && !element.played) {
					element.played = true;
					task.spawn(() => {
						track.keyframe_reached.Fire(element.name);
					});
				}
			}

			track.last_keyframe = first;
			const bias = map(track.time, first.time, last.time, 0, 1);
			for (const [_, value] of pairs(first.children)) {
				const bone = this.identified_bones[value.name];
				if (bone) {
					const a = value;
					const b = last.children[value.name];

					const unbiased_cframe = a.cframe.Lerp(b.cframe, bias);
					let weight = track.bone_weights[value.name] || track.bone_weights["__CANIM_DEFAULT_BONE_WEIGHT"];
					let simple_weight = track.weight;

					let blended_cframe = unbiased_cframe;
					if (weight) {
						let components = blended_cframe.ToEulerAnglesXYZ();
						blended_cframe = new CFrame(
							unbiased_cframe.X * weight[0][0] * simple_weight,
							unbiased_cframe.Y * weight[0][1] * simple_weight,
							unbiased_cframe.Z * weight[0][2] * simple_weight
						);

						blended_cframe = blended_cframe.mul(
							CFrame.Angles(
								components[0] * weight[1][0] * simple_weight,
								components[1] * weight[1][1] * simple_weight,
								components[2] * weight[1][2] * simple_weight
							)
						);
					}

					if (
						track.rebase_target &&
						track.rebase_target.keyframe &&
						track.rebase_target.keyframe.children[bone.Part1!.Name]
					) {
						if (
							track.rebase_basis &&
							track.rebase_basis.keyframe &&
							track.rebase_basis.keyframe.children[bone.Part1!.Name]
						) {
							let basis = track.rebase_basis.keyframe.children[bone.Part1!.Name].cframe;

							// rebase blended_cframe from rebase_basis to rebase_target
							blended_cframe = blended_cframe.mul(basis.Inverse());
						} else {
							blended_cframe = blended_cframe.mul(
								track.rebase_target.keyframe!.children[bone.Part1!.Name].cframe.Inverse()
							);
						}

						let sum: [number, CFrame][] = weight_sum_rebased.get(bone) || [];
						sum.push([track.priority, blended_cframe]);
						weight_sum_rebased.set(bone, sum);
					} else {
						let sum = weight_sum.get(bone) || [];
						sum.push([track.priority, blended_cframe]);
						weight_sum.set(bone, sum);
					}
				}
			}
		}

		for (const [_, track] of pairs(this.playing_poses)) {
			debug.push(`Pose ${track.name} ${track.time}`);
			if (!track.loaded || !track.keyframe) continue;

			const first: customKeyframe | undefined = track.keyframe;
			if (!first) throw "invalid Keyframe (none)";

			for (const [_, value] of pairs(first.children)) {
				const bone = this.identified_bones[value.name];
				if (bone) {
					let sum = weight_sum.get(bone) || [];
					sum.push([track.priority, value.cframe]);
					weight_sum.set(bone, sum);
				}
			}
		}

		for (const [index, value] of pairs(this.identified_bones)) {
			let sum = weight_sum.get(value) || [];
			sum.push([-1000, new CFrame()]);
			weight_sum.set(value, sum);
		}

		for (const [index, value] of weight_sum) {
			table.sort(value, (a, b) => {
				return a[0] > b[0];
			});

			// transitions only work inbetween the last animation to play and any poses.
			if (index.Part1) {
				let target_cframe = value[0][1];
				let transitions = this.transitions[index.Part1.Name];

				if (transitions) {
					for (const [transition_index, transition] of pairs(transitions)) {
						if (transition.finish === 0) {
							transition.finish = tick() + math.huge;
							delete transitions[transition_index - 1];
						}

						if (transition.finish >= tick() && weight_sum.get(index)!.size() <= 2) {
							let alpha = ease_in_out_quad(map(tick(), transition.start, transition.finish, 1, 0));
							target_cframe = target_cframe.Lerp(transition.cframe, alpha);
						} else if (transition.finish <= tick()) {
							delete transitions[transition_index - 1];
						}
					}
				}

				bone_totals.set(index, target_cframe); // (bone_totals.get(index) || new CFrame()).mul(target_cframe));
			}
		}

		for (const [index, value] of weight_sum_rebased) {
			if (!index.Part1) continue;
			for (const [_, data] of pairs(value)) {
				let target_cframe = data[1];
				let transitions = this.transitions[index.Part1.Name];
				if (transitions) {
					for (const [transition_index, transition] of pairs(transitions)) {
						if (transition && transition.finish >= tick() && weight_sum.get(index)!.size() === 1) {
							let alpha = ease_in_out_quad(map(tick(), transition.start, transition.finish, 1, 0));
							target_cframe = target_cframe.Lerp(transition.cframe, alpha);
						} else {
							delete transitions[transition_index];
						}
					}
				}

				bone_totals.set(index, target_cframe.mul(bone_totals.get(index) || new CFrame()));
			}
		}

		for (const [index, value] of bone_totals) {
			index.Transform = value;
		}

		this.playing_animations = new_playing;
		this.debug = debug;
	}
}
