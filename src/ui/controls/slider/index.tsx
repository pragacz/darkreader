import {m} from 'malevic';
import {getContext} from 'malevic/dom';
import {throttle} from '../../../inject/utils/throttle';

interface SliderProps {
    value: number;
    min: number;
    max: number;
    step: number;
    formatValue: (value: number) => string;
    onChange: (value: number) => void;
}

function clamp(x: number, min: number, max: number) {
    return Math.min(max, Math.max(min, x));
}

function scale(x: number, inLow: number, inHigh: number, outLow: number, outHigh: number) {
    return (x - inLow) / (inHigh - inLow) * (outHigh - outLow) + outLow;
}

function stickToStep(x: number, step: number) {
    const s = Math.round(x / step) * step;
    const exp = Math.floor(Math.log10(step));
    if (exp >= 0) {
        const m = Math.pow(10, exp);
        return Math.round(s / m) * m;
    } else {
        const m = Math.pow(10, -exp);
        return Math.round(s * m) / m;
    }
}

export default function Slider(props: SliderProps) {
    const context = getContext();
    const store = context.store as {
        isActive: boolean;
        activeValue: number;
        activeProps: SliderProps;
        trackNode: HTMLElement;
        thumbNode: HTMLElement;
    };
    let scrollTimer: number = null;

    store.activeProps = props;

    function onRootCreate(rootNode: HTMLElement) {
        rootNode.addEventListener('touchstart', onPointerDown, {passive: true});
    }

    function saveTrackNode(el: HTMLElement) {
        store.trackNode = el;
    }

    function getTrackNode() {
        return store.trackNode as HTMLElement;
    }

    function saveThumbNode(el: HTMLElement) {
        store.thumbNode = el;
    }

    function getThumbNode() {
        return store.thumbNode as HTMLElement;
    }

    function onPointerDown(startEvt: MouseEvent | TouchEvent) {
        if (store.isActive) {
            return;
        }

        const {
            getClientX,
            pointerMoveEvent,
            pointerUpEvent,
        } = (() => {
            const isTouchEvent =
                typeof TouchEvent !== 'undefined' &&
                startEvt instanceof TouchEvent;
            const touchId = isTouchEvent
                ? (startEvt as TouchEvent).changedTouches[0].identifier
                : null;

            function getTouch(e: TouchEvent) {
                const find = (touches: TouchList) => Array.from(touches).find((t) => t.identifier === touchId);
                return find(e.changedTouches) || find(e.touches);
            }

            function getClientX(e: MouseEvent | TouchEvent) {
                const {clientX} = isTouchEvent
                    ? getTouch(e as TouchEvent)
                    : e as MouseEvent;
                return clientX;
            }

            const pointerMoveEvent = isTouchEvent ? 'touchmove' : 'mousemove';
            const pointerUpEvent = isTouchEvent ? 'touchend' : 'mouseup';

            return {getClientX, pointerMoveEvent, pointerUpEvent};
        })();

        const dx = (() => {
            const thumbRect = getThumbNode().getBoundingClientRect();
            const startClientX = getClientX(startEvt);
            const isThumbPressed = startClientX >= thumbRect.left && startClientX <= thumbRect.right;
            return isThumbPressed ? (thumbRect.left + thumbRect.width / 2 - startClientX) : 0;
        })();

        function getEventValue(e: MouseEvent | TouchEvent) {
            const {min, max} = store.activeProps;
            const clientX = getClientX(e);
            const rect = getTrackNode().getBoundingClientRect();
            const scaled = scale(clientX + dx, rect.left, rect.right, min, max);
            const clamped = clamp(scaled, min, max);
            return clamped;
        }

        function onPointerMove(e: MouseEvent | TouchEvent) {
            const value = getEventValue(e);
            store.activeValue = value;
            context.refresh();
        }

        function onPointerUp(e: MouseEvent | TouchEvent) {
            unsubscribe();
            const value = getEventValue(e);
            store.isActive = false;
            context.refresh();
            store.activeValue = null;

            const {onChange, step} = store.activeProps;
            onChange(stickToStep(value, step));
        }

        function onKeyPress(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                unsubscribe();
                store.isActive = false;
                store.activeValue = null;
                context.refresh();
            }
        }

        function subscribe() {
            window.addEventListener(pointerMoveEvent, onPointerMove, {passive: true});
            window.addEventListener(pointerUpEvent, onPointerUp, {passive: true});
            window.addEventListener('keypress', onKeyPress);
        }

        function unsubscribe() {
            window.removeEventListener(pointerMoveEvent, onPointerMove);
            window.removeEventListener(pointerUpEvent, onPointerUp);
            window.removeEventListener('keypress', onKeyPress);
        }

        subscribe();
        store.isActive = true;
        store.activeValue = getEventValue(startEvt);
        context.refresh();
    }

    function getValue() {
        return store.activeValue == null ? props.value : store.activeValue;
    }

    const percent = scale(getValue(), props.min, props.max, 0, 100);
    const thumbPositionStyleValue = `${percent}%`;
    const shouldFlipText = percent > 75;
    const formattedValue = props.formatValue(
        stickToStep(getValue(), props.step)
    );

    function onWheel(event: WheelEvent) {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            const {onChange} = store.activeProps;
            onChange(store.activeValue);
        }, 600);

        event.preventDefault();
        let value = getValue();
        value += event.deltaY * (props.max - props.min) * -0.001;
        store.activeValue = stickToStep(clamp(value, props.min, props.max), props.step);
        throttle(() => {
            context.refresh();
        })
    }

    return (
        <span
            class={{'slider': true, 'slider--active': store.isActive}}
            oncreate={onRootCreate}
            onmousedown={onPointerDown}
            onwheel={onWheel}
        >
            <span
                class="slider__track"
                oncreate={saveTrackNode}
            >
                <span
                    class="slider__track__fill"
                    style={{width: thumbPositionStyleValue}}
                ></span>
            </span>
            <span class="slider__thumb-wrapper">
                <span
                    class="slider__thumb"
                    oncreate={saveThumbNode}
                    style={{left: thumbPositionStyleValue}}
                >
                    <span
                        class={{
                            'slider__thumb__value': true,
                            'slider__thumb__value--flip': shouldFlipText,
                        }}
                    >
                        {formattedValue}
                    </span>
                </span>
            </span>
        </span>
    );
}
