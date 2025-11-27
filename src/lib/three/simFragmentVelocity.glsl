uniform sampler2D uOriginalPosition;

void main() {
    vec2 vUv = gl_FragCoord.xy / resolution.xy;

    vec3 position = texture2D( uCurrentPosition, vUv ).xyz;
    vec3 original = texture2D( uOriginalPosition, vUv ).xyz;
    vec3 velocity = texture2D( uCurrentVelocity, vUv ).xyz;

    gl_FragColor = vec4(velocity, 1.);
}