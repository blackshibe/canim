import Signal from "./dependencies/Signal";
import Maid from "./dependencies/Maid";
import easing from "../src/easing/easing";

const RunService = game.GetService("RunService");
const KeyframeSequenceProvider = game.GetService("KeyframeSequenceProvider");

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

declare type customPose = { name: string; cframe: CFrame; weight: number };
declare type customKeyframe = { name: string; time: number; children: { [index: string]: customPose } };
declare type customKeyframeSequence = { name: string; children: customKeyframe[] };
declare type easingFunction = (alpha: number) => number;

// easing.d.ts isn't exported when the package is packed so the types have to be copied over into here
interface easingType {
	linear: easingFunction;
	quad_in: easingFunction;
	quad_out: easingFunction;
	quad_in_out: easingFunction;
	quad_out_in: easingFunction;
	cubic_in: easingFunction;
	cubic_out: easingFunction;
	cubic_in_out: easingFunction;
	cubic_out_in: easingFunction;
	quart_in: easingFunction;
	quart_out: easingFunction;
	quart_in_out: easingFunction;
	quart_out_in: easingFunction;
	quint_in: easingFunction;
	quint_out: easingFunction;
	quint_in_out: easingFunction;
	quint_out_in: easingFunction;
	sine_in: easingFunction;
	sine_out: easingFunction;
	sine_in_out: easingFunction;
	sine_out_in: easingFunction;
	expo_in: easingFunction;
	expo_out: easingFunction;
	expo_in_out: easingFunction;
	expo_out_in: easingFunction;
	circ_in: easingFunction;
	circ_out: easingFunction;
	circ_in_out: easingFunction;
	circ_out_in: easingFunction;
	elastic_in: easingFunction;
	elastic_out: easingFunction;
	elastic_in_out: easingFunction;
	elastic_out_in: easingFunction;
	back_in: easingFunction;
	back_out: easingFunction;
	back_in_out: easingFunction;
	back_out_in: easingFunction;
	bounce_in: easingFunction;
	bounce_out: easingFunction;
	bounce_in_out: easingFunction;
	bounce_out_in: easingFunction;
}

const cached_tracks: { [index: string]: KeyframeSequence | undefined } = {};
const active_caching_requests: { [index: string]: boolean } = {};
export const cache_get_keyframe_sequence = (id: string): KeyframeSequence => {
	// prevents a race condition
	while (active_caching_requests[id]) RunService.Heartbeat.Wait();

	let sequence = cached_tracks[id];
	if (sequence) return sequence.Clone();

	const [success, fail] = pcall(() => {
		active_caching_requests[id] = true;
		sequence = KeyframeSequenceProvider.GetKeyframeSequenceAsync(id);
		active_caching_requests[id] = false;
	});

	if (!success || !sequence) {
		warn(`GetKeyframeSequenceAsync() failed for id ${id}`);
		warn(fail);

		active_caching_requests[id] = false;

		return cache_get_keyframe_sequence(id);
	}

	// a new call is made to clone the keyframe
	cached_tracks[id] = sequence;
	return cache_get_keyframe_sequence(id);
};

const map = (value: number, in_min: number, in_max: number, out_min: number, out_max: number) =>
	((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;

const is_pose = (track: CanimTrack | CanimPose): track is CanimPose => {
	return track.animation_type === animationType.pose;
};

const is_track = (track: CanimTrack | CanimPose): track is CanimTrack => {
	return track.animation_type === animationType.track;
};

// conversion functions that go from Roblox format to canim
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

export const enum animationType {
	track,
	pose,
}

export class CanimPose {
	animation_type = animationType.pose;

	keyframe?: customKeyframe;
	keyframe_reached = new Signal<(name: string) => void>();
	finished_loading = new Signal<() => void>();
	started = new Signal<() => void>();
	finished = new Signal<() => void>();

	// unused
	transitions: { [index: string]: transition } = {};
	bone_weights: { [index: string]: [[number, number, number], [number, number, number]] | undefined } = {};

	name = "animation_track";
	loaded = false;
	priority = 0;
	weight = 1;
	time = 0;
	looped = false;
	stopping = false;
	fade_time = 0.3;
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

export class CanimTrack {
	animation_type = animationType.track;

	sequence?: customKeyframeSequence;
	last_keyframe?: customKeyframe;
	rebase_target?: CanimPose;
	rebase_basis?: CanimPose;

	transition_disable: { [index: string]: boolean } = {};
	keyframe_reached = new Signal<(name: string) => void>();
	finished_loading = new Signal<() => void>();
	finished = new Signal<() => void>();
	started = new Signal<() => void>();

	signals: signalInfo[] = [];
	bone_weights: { [index: string]: [[number, number, number], [number, number, number]] | undefined } = {};
	disable_rebasing: { [index: string]: boolean | undefined } = {};

	name = "animation_track";

	stopping = false;
	init_transitions = false;

	loaded = false;
	priority = 0;
	weight = 1;
	speed = 1;
	time = 0;
	length = 0;
	looped = false;
	fade_time = 0.3;
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

			if (!highest_keyframe) return;

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

export class Canim {
	identified_bones: { [index: string]: Motor6D | undefined } = {};
	playing_animations: Map<string, CanimTrack> = new Map();
	playing_poses: Map<string, CanimPose> = new Map();

	new_animations: Map<string, CanimTrack> = new Map();
	queue_to_new_animations = false;

	animations: {
		[index: string]: CanimTrack | CanimPose | undefined;
	} = {};

	transitions: Map<Motor6D, [number, transition][]> = new Map();
	transitions_rebased: Map<Motor6D, [number, transition][]> = new Map();

	// transitions: {
	// 	[index: string]:
	// 		| Array<{
	// 				start: number;
	// 				finish: number;
	// 				cframe: CFrame;
	// 		  }>
	// 		| undefined;
	// } = {};

	model?: Instance;
	maid = new Maid();
	debug: string[] = [];

	fadeout_easing = easing.quad_in_out;

	constructor() {}

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
		if (is_pose(track)) throw "attempted to play a pose as an animation";

		track.playing = true;
		track.time = 0;
		track.started.Fire();
		track.signals.forEach((element) => {
			element.played = false;
		});

		if (this.queue_to_new_animations) this.new_animations.set(track.name, track);
		else this.playing_animations.set(track.name, track);

		return track;
	}

	play_pose(id: string) {
		const pose = this.animations[id];
		if (!pose) return warn("invalid animation: ", id);
		if (is_track(pose)) throw "attempted to play an animation as a pose";

		pose.started.Fire();
		this.playing_poses.set(pose.name, pose);

		return pose;
	}

	stop_animation(name: string) {
		let track = this.playing_animations.get(name);
		let pose = this.playing_poses.get(name);

		if (track) track.stopping = true;
		if (pose) this.finish_animation(pose);
	}

	update_track(
		track: CanimTrack,
		weight_sum_rebased: Map<Motor6D, [number, CFrame][]>,
		weight_sum: Map<Motor6D, [number, CFrame][]>
	) {
		let first: customKeyframe | undefined = undefined;
		let last: customKeyframe | undefined = undefined;
		for (const [_, keyframe] of pairs(track.sequence!.children)) {
			if (keyframe.time >= track.time && !last) last = keyframe;
			else if (keyframe.time <= track.time) first = keyframe;
		}

		if (!first || !last) {
			this.debug.push(`Invalid KeyframeSequence for track named ${track.name}, time: ${track.time}`);
			return;
		}

		for (const [_, element] of pairs(track.signals)) {
			if (track.time >= element.time && !element.played) {
				element.played = true;
				track.keyframe_reached.Fire(element.name);
			}
		}

		track.last_keyframe = first;
		const bias = map(track.time, first.time, last.time, 0, 1);
		for (const [_, value] of pairs(first.children)) {
			const bone = this.identified_bones[value.name];
			if (bone && bone.Part1) {
				const a = value;
				const b = last.children[value.name];
				const unblended_cframe = a.cframe.Lerp(b.cframe, bias);

				let disable_transitions = track.transition_disable_all || track.transition_disable[value.name];
				let weight = track.bone_weights[value.name] ||
					track.bone_weights["__CANIM_DEFAULT_BONE_WEIGHT"] || [
						[1, 1, 1],
						[1, 1, 1],
					];

				let blended_cframe = unblended_cframe;
				let part1_name = bone.Part1.Name;

				if (
					!track.disable_rebasing[part1_name] &&
					track.rebase_target &&
					track.rebase_target.keyframe &&
					track.rebase_target.keyframe.children[part1_name]
				) {
					if (
						track.rebase_basis &&
						track.rebase_basis.keyframe &&
						track.rebase_basis.keyframe.children[part1_name]
					) {
						let basis = track.rebase_basis.keyframe.children[part1_name].cframe;
						blended_cframe = blended_cframe.mul(basis.Inverse());
					} else {
						blended_cframe = blended_cframe.mul(
							track.rebase_target.keyframe!.children[part1_name].cframe.Inverse()
						);
					}

					let components = blended_cframe.ToEulerAnglesXYZ();
					blended_cframe = new CFrame(
						blended_cframe.X * weight[0][0] * track.weight,
						blended_cframe.Y * weight[0][1] * track.weight,
						blended_cframe.Z * weight[0][2] * track.weight
					);

					blended_cframe = blended_cframe.mul(
						CFrame.Angles(
							components[0] * weight[1][0] * track.weight,
							components[1] * weight[1][1] * track.weight,
							components[2] * weight[1][2] * track.weight
						)
					);

					if (track.init_transitions) {
						if (!disable_transitions) {
							let sum = this.transitions_rebased.get(bone) || [];
							sum.push([
								track.priority,
								{
									start: tick(),
									finish: tick() + track.fade_time,
									cframe: blended_cframe,
								},
							]);
							this.transitions_rebased.set(bone, sum);
						}
					} else {
						let sum: [number, CFrame][] = weight_sum_rebased.get(bone) || [];
						sum.push([track.priority, blended_cframe]);
						weight_sum_rebased.set(bone, sum);
					}
				} else {
					let components = blended_cframe.ToEulerAnglesXYZ();

					blended_cframe = new CFrame(
						unblended_cframe.X * weight[0][0] * track.weight,
						unblended_cframe.Y * weight[0][1] * track.weight,
						unblended_cframe.Z * weight[0][2] * track.weight
					);

					blended_cframe = blended_cframe.mul(
						CFrame.Angles(
							components[0] * weight[1][0] * track.weight,
							components[1] * weight[1][1] * track.weight,
							components[2] * weight[1][2] * track.weight
						)
					);

					if (track.init_transitions && !disable_transitions) {
						let sum = this.transitions.get(bone) || [];
						sum.push([
							track.priority,
							{
								start: tick(),
								finish: tick() + track.fade_time,
								cframe: blended_cframe,
							},
						]);
						this.transitions.set(bone, sum);
					} else {
						let sum = weight_sum.get(bone) || [];
						sum.push([track.priority, blended_cframe]);
						weight_sum.set(bone, sum);
					}
				}
			}
		}
	}

	private finish_animation(track: CanimTrack | CanimPose) {
		track.stopping = false;
		track.finished.Fire();

		if (is_pose(track)) {
			this.playing_poses.delete(track.name);
		} else {
			this.playing_animations.delete(track.name);
			track.playing = false;
		}
	}

	update_track_state(track: CanimTrack, delta_time: number) {
		if (!track.loaded || !track.sequence) return;

		track.time += delta_time * track.speed;
		if (track.time >= track.length) {
			if (track.looped) {
				for (const [_, element] of pairs(track.signals)) element.played = false;
				track.finished.Fire();
				track.time -= track.length;
			} else {
				track.stopping = true;
				track.time = track.length;
			}
		}

		let init_transitions = false;
		if (track.stopping) {
			init_transitions = true;
			this.finish_animation(track);

			if (track.transition_disable_all) return;
		}

		track.init_transitions = init_transitions;

		let str = `Track name=${track.name} looped=${track.looped} time=${track.time} weight=${track.weight}`;
		if (init_transitions) str += " stopping";
		this.debug.push(str);

		if (track.weight === 0) return;

		return true;
	}

	update(delta_time: number) {
		const weight_sum = new Map<Motor6D, [number, CFrame][]>();
		const weight_sum_rebased = new Map<Motor6D, [number, CFrame][]>();
		const bone_totals = new Map<Motor6D, CFrame>();

		this.debug = [];
		this.queue_to_new_animations = true;
		this.new_animations = new Map();

		let animation_list: CanimTrack[] = [];
		for (const [_, track] of pairs(this.playing_animations)) {
			let should_push_to_animations = this.update_track_state(track, delta_time);
			if (should_push_to_animations) animation_list.push(track);
		}

		// sometimes the finished event queues more animations this frame so they also need to be iterated over
		// it can be done above but it makes for non deterministic behavior and flickering
		for (const [_, track] of pairs(this.new_animations)) {
			let should_push_to_animations = this.update_track_state(track, delta_time);
			if (should_push_to_animations) animation_list.push(track);
			this.playing_animations.set(track.name, track);
		}

		this.queue_to_new_animations = false;

		// needs to stay consistent or otherwise the animations will be layered incorrectly, causing flickering
		// animations should generally assign different priorities because of this
		table.sort(animation_list, (a, b) => {
			return a.priority > b.priority;
		});

		for (const [_, value] of pairs(animation_list)) {
			this.update_track(value, weight_sum_rebased, weight_sum);
		}

		for (const [_, track] of pairs(this.playing_poses)) {
			this.debug.push(`Pose ${track.name} ${track.time}`);
			if (!track.loaded || !track.keyframe) continue;

			const first: customKeyframe | undefined = track.keyframe;
			if (!first) {
				this.debug.push(`Invalid KeyframeSequence for pose named ${track.name}, time: ${track.time}`);
				continue;
			}

			for (const [_, value] of pairs(first.children)) {
				const bone = this.identified_bones[value.name];
				if (bone) {
					let cframe = value.cframe;
					let components = cframe.ToEulerAnglesXYZ();

					let weight = track.bone_weights[value.name] ||
						track.bone_weights["__CANIM_DEFAULT_BONE_WEIGHT"] || [
							[1, 1, 1],
							[1, 1, 1],
						];

					cframe = new CFrame(
						cframe.X * weight[0][0] * track.weight,
						cframe.Y * weight[0][1] * track.weight,
						cframe.Z * weight[0][2] * track.weight
					);

					cframe = cframe.mul(
						CFrame.Angles(
							components[0] * weight[1][0] * track.weight,
							components[1] * weight[1][1] * track.weight,
							components[2] * weight[1][2] * track.weight
						)
					);

					let sum = weight_sum.get(bone) || [];
					sum.push([track.priority, cframe]);
					weight_sum.set(bone, sum);
				}
			}
		}

		// this is required for transitions to work as otherwise the transitions aren't processed below
		for (const [index, value] of pairs(this.identified_bones)) {
			let sum = weight_sum.get(value) || [];
			sum.push([-math.huge, new CFrame()]);
			weight_sum.set(value, sum);

			let rebased_sum = weight_sum_rebased.get(value) || [];
			rebased_sum.push([-math.huge, new CFrame()]);
			weight_sum_rebased.set(value, rebased_sum);
		}

		// regular animations display the lowest priority animation without any layering, so you simply sort what's playing and use the first result
		for (const [motor, animation_cframes] of weight_sum) {
			if (!motor.Part1) continue;
			table.sort(animation_cframes, (a, b) => {
				return a[0] > b[0];
			});

			let target_cframe = animation_cframes[0][1];
			let transitions = this.transitions.get(motor);

			if (transitions) {
				for (const [transition_index, [priority, transition]] of pairs(transitions)) {
					if (transition.finish === 0) {
						transition.finish = tick() + math.huge;
						delete transitions[transition_index - 1];
					}

					if (transition.finish >= tick() && weight_sum.get(motor)!.size() <= 2) {
						let alpha = this.fadeout_easing(map(tick(), transition.start, transition.finish, 1, 0));
						target_cframe = target_cframe.Lerp(transition.cframe, alpha);
					} else if (transition.finish <= tick()) {
						delete transitions[transition_index - 1];
					}
				}
			}

			bone_totals.set(motor, target_cframe);
		}

		// rebased animations can be layered so they have to iterate
		for (const [motor, animation_cframes] of weight_sum_rebased) {
			if (!motor.Part1) continue;
			let target_cframe = new CFrame();

			for (const [_, [id, cframe]] of pairs(animation_cframes)) {
				let iteration_target_cframe = cframe;
				target_cframe = target_cframe.mul(iteration_target_cframe);
			}

			let transitions = this.transitions_rebased.get(motor);

			if (transitions) {
				let transition_amount = transitions.size();
				if (transition_amount === 0) this.transitions_rebased.delete(motor);

				this.debug.push(`Motor Transition ${motor.Name} ${transition_amount}`);
				for (const [transition_index, [id, transition]] of pairs(transitions)) {
					if (transition.finish === 0) {
						transition.finish = tick() + math.huge;
						delete transitions[transition_index - 1];
					}

					if (transition.finish >= tick()) {
						let alpha = this.fadeout_easing(map(tick(), transition.start, transition.finish, 1, 0));
						target_cframe = target_cframe.mul(new CFrame().Lerp(transition.cframe, alpha));
					} else if (transition.finish <= tick()) {
						delete transitions[transition_index - 1];
					}
				}
			}

			let existing_cf = bone_totals.get(motor);
			if (existing_cf) {
				bone_totals.set(motor, target_cframe.mul(existing_cf));
			} else {
				bone_totals.set(motor, target_cframe);
			}
		}

		// sometimes there isn't any actual animation playing except for a transition
		// untested lol
		for (const [motor, transitions] of this.transitions_rebased) {
			if (!motor.Part1) continue;

			let motor_weight_sums = weight_sum_rebased.get(motor);
			if (motor_weight_sums) continue;

			let target_cframe = new CFrame();
			let transition_amount = transitions.size();
			if (transition_amount === 0) this.transitions_rebased.delete(motor);

			this.debug.push(`Motor Transition ${motor.Name} ${transition_amount}`);
			for (const [transition_index, [id, transition]] of pairs(transitions)) {
				if (transition.finish === 0) {
					transition.finish = tick() + math.huge;
					delete transitions[transition_index - 1];
				}

				if (transition.finish >= tick()) {
					let alpha = this.fadeout_easing(map(tick(), transition.start, transition.finish, 1, 0));
					target_cframe = target_cframe.mul(new CFrame().Lerp(transition.cframe, alpha));
				} else if (transition.finish <= tick()) {
					delete transitions[transition_index - 1];
				}
			}

			let existing_cf = bone_totals.get(motor);
			if (existing_cf) bone_totals.set(motor, target_cframe.mul(existing_cf));
			else bone_totals.set(motor, target_cframe);
		}

		for (const [index, value] of bone_totals) index.Transform = value;
	}
}

export const CanimEasing = easing as easingType;
