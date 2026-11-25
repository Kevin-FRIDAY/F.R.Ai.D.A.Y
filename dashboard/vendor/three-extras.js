// three.js r128 Zusätze (MIT, three.js authors): Nachleuchten (Bloom), Skelett-Klonen, Raum-Licht fürs 3D-Büro.

// ---- CopyShader.js ----
( function () {

	/**
 * Full-screen textured quad shader
 */
	var CopyShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'opacity': {
				value: 1.0
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;

		}`
	};

	THREE.CopyShader = CopyShader;

} )();

// ---- LuminosityHighPassShader.js ----
( function () {

	/**
 * Luminosity
 * http://en.wikipedia.org/wiki/Luminosity
 */

	const LuminosityHighPassShader = {
		shaderID: 'luminosityHighPass',
		uniforms: {
			'tDiffuse': {
				value: null
			},
			'luminosityThreshold': {
				value: 1.0
			},
			'smoothWidth': {
				value: 1.0
			},
			'defaultColor': {
				value: new THREE.Color( 0x000000 )
			},
			'defaultOpacity': {
				value: 0.0
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			vec3 luma = vec3( 0.299, 0.587, 0.114 );

			float v = dot( texel.xyz, luma );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`
	};

	THREE.LuminosityHighPassShader = LuminosityHighPassShader;

} )();

// ---- GammaCorrectionShader.js ----
( function () {

	/**
 * Gamma Correction Shader
 * http://en.wikipedia.org/wiki/gamma_correction
 */
	const GammaCorrectionShader = {
		uniforms: {
			'tDiffuse': {
				value: null
			}
		},
		vertexShader:
  /* glsl */
  `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
		fragmentShader:
  /* glsl */
  `

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 tex = texture2D( tDiffuse, vUv );

			gl_FragColor = LinearTosRGB( tex ); // optional: LinearToGamma( tex, float( GAMMA_FACTOR ) );

		}`
	};

	THREE.GammaCorrectionShader = GammaCorrectionShader;

} )();

// ---- EffectComposer.js ----
( function () {

	class EffectComposer {

		constructor( renderer, renderTarget ) {

			this.renderer = renderer;

			if ( renderTarget === undefined ) {

				const parameters = {
					minFilter: THREE.LinearFilter,
					magFilter: THREE.LinearFilter,
					format: THREE.RGBAFormat
				};
				const size = renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = new THREE.WebGLRenderTarget( this._width * this._pixelRatio, this._height * this._pixelRatio, parameters );
				renderTarget.texture.name = 'EffectComposer.rt1';

			} else {

				this._pixelRatio = 1;
				this._width = renderTarget.width;
				this._height = renderTarget.height;

			}

			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.renderTarget2.texture.name = 'EffectComposer.rt2';
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;
			this.renderToScreen = true;
			this.passes = []; // dependencies

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.CopyShader' );

			}

			if ( THREE.ShaderPass === undefined ) {

				console.error( 'THREE.EffectComposer relies on THREE.ShaderPass' );

			}

			this.copyPass = new THREE.ShaderPass( THREE.CopyShader );
			this.clock = new THREE.Clock();

		}

		swapBuffers() {

			const tmp = this.readBuffer;
			this.readBuffer = this.writeBuffer;
			this.writeBuffer = tmp;

		}

		addPass( pass ) {

			this.passes.push( pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}

		insertPass( pass, index ) {

			this.passes.splice( index, 0, pass );
			pass.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

		}

		removePass( pass ) {

			const index = this.passes.indexOf( pass );

			if ( index !== - 1 ) {

				this.passes.splice( index, 1 );

			}

		}

		isLastEnabledPass( passIndex ) {

			for ( let i = passIndex + 1; i < this.passes.length; i ++ ) {

				if ( this.passes[ i ].enabled ) {

					return false;

				}

			}

			return true;

		}

		render( deltaTime ) {

			// deltaTime value is in seconds
			if ( deltaTime === undefined ) {

				deltaTime = this.clock.getDelta();

			}

			const currentRenderTarget = this.renderer.getRenderTarget();
			let maskActive = false;

			for ( let i = 0, il = this.passes.length; i < il; i ++ ) {

				const pass = this.passes[ i ];
				if ( pass.enabled === false ) continue;
				pass.renderToScreen = this.renderToScreen && this.isLastEnabledPass( i );
				pass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive );

				if ( pass.needsSwap ) {

					if ( maskActive ) {

						const context = this.renderer.getContext();
						const stencil = this.renderer.state.buffers.stencil; //context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );

						stencil.setFunc( context.NOTEQUAL, 1, 0xffffffff );
						this.copyPass.render( this.renderer, this.writeBuffer, this.readBuffer, deltaTime ); //context.stencilFunc( context.EQUAL, 1, 0xffffffff );

						stencil.setFunc( context.EQUAL, 1, 0xffffffff );

					}

					this.swapBuffers();

				}

				if ( THREE.MaskPass !== undefined ) {

					if ( pass instanceof THREE.MaskPass ) {

						maskActive = true;

					} else if ( pass instanceof THREE.ClearMaskPass ) {

						maskActive = false;

					}

				}

			}

			this.renderer.setRenderTarget( currentRenderTarget );

		}

		reset( renderTarget ) {

			if ( renderTarget === undefined ) {

				const size = this.renderer.getSize( new THREE.Vector2() );
				this._pixelRatio = this.renderer.getPixelRatio();
				this._width = size.width;
				this._height = size.height;
				renderTarget = this.renderTarget1.clone();
				renderTarget.setSize( this._width * this._pixelRatio, this._height * this._pixelRatio );

			}

			this.renderTarget1.dispose();
			this.renderTarget2.dispose();
			this.renderTarget1 = renderTarget;
			this.renderTarget2 = renderTarget.clone();
			this.writeBuffer = this.renderTarget1;
			this.readBuffer = this.renderTarget2;

		}

		setSize( width, height ) {

			this._width = width;
			this._height = height;
			const effectiveWidth = this._width * this._pixelRatio;
			const effectiveHeight = this._height * this._pixelRatio;
			this.renderTarget1.setSize( effectiveWidth, effectiveHeight );
			this.renderTarget2.setSize( effectiveWidth, effectiveHeight );

			for ( let i = 0; i < this.passes.length; i ++ ) {

				this.passes[ i ].setSize( effectiveWidth, effectiveHeight );

			}

		}

		setPixelRatio( pixelRatio ) {

			this._pixelRatio = pixelRatio;
			this.setSize( this._width, this._height );

		}

	}

	class Pass {

		constructor() {

			// if set to true, the pass is processed by the composer
			this.enabled = true; // if set to true, the pass indicates to swap read and write buffer after rendering

			this.needsSwap = true; // if set to true, the pass clears its buffer before rendering

			this.clear = false; // if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.

			this.renderToScreen = false;

		}

		setSize( ) {}

		render( ) {

			console.error( 'THREE.Pass: .render() must be implemented in derived pass.' );

		}

	} // Helper for passes that need to fill the viewport with a single quad.


	const _camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0, 1 ); // https://github.com/mrdoob/three.js/pull/21358


	const _geometry = new THREE.BufferGeometry();

	_geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ - 1, 3, 0, - 1, - 1, 0, 3, - 1, 0 ], 3 ) );

	_geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 2, 0, 0, 2, 0 ], 2 ) );

	class FullScreenQuad {

		constructor( material ) {

			this._mesh = new THREE.Mesh( _geometry, material );

		}

		dispose() {

			this._mesh.geometry.dispose();

		}

		render( renderer ) {

			renderer.render( this._mesh, _camera );

		}

		get material() {

			return this._mesh.material;

		}

		set material( value ) {

			this._mesh.material = value;

		}

	}

	THREE.EffectComposer = EffectComposer;
	THREE.FullScreenQuad = FullScreenQuad;
	THREE.Pass = Pass;

} )();

// ---- RenderPass.js ----
( function () {

	class RenderPass extends THREE.Pass {

		constructor( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

			super();
			this.scene = scene;
			this.camera = camera;
			this.overrideMaterial = overrideMaterial;
			this.clearColor = clearColor;
			this.clearAlpha = clearAlpha !== undefined ? clearAlpha : 0;
			this.clear = true;
			this.clearDepth = false;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();

		}

		render( renderer, writeBuffer, readBuffer
			/*, deltaTime, maskActive */
		) {

			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			let oldClearAlpha, oldOverrideMaterial;

			if ( this.overrideMaterial !== undefined ) {

				oldOverrideMaterial = this.scene.overrideMaterial;
				this.scene.overrideMaterial = this.overrideMaterial;

			}

			if ( this.clearColor ) {

				renderer.getClearColor( this._oldClearColor );
				oldClearAlpha = renderer.getClearAlpha();
				renderer.setClearColor( this.clearColor, this.clearAlpha );

			}

			if ( this.clearDepth ) {

				renderer.clearDepth();

			}

			renderer.setRenderTarget( this.renderToScreen ? null : readBuffer ); // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600

			if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
			renderer.render( this.scene, this.camera );

			if ( this.clearColor ) {

				renderer.setClearColor( this._oldClearColor, oldClearAlpha );

			}

			if ( this.overrideMaterial !== undefined ) {

				this.scene.overrideMaterial = oldOverrideMaterial;

			}

			renderer.autoClear = oldAutoClear;

		}

	}

	THREE.RenderPass = RenderPass;

} )();

// ---- ShaderPass.js ----
( function () {

	class ShaderPass extends THREE.Pass {

		constructor( shader, textureID ) {

			super();
			this.textureID = textureID !== undefined ? textureID : 'tDiffuse';

			if ( shader instanceof THREE.ShaderMaterial ) {

				this.uniforms = shader.uniforms;
				this.material = shader;

			} else if ( shader ) {

				this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );
				this.material = new THREE.ShaderMaterial( {
					defines: Object.assign( {}, shader.defines ),
					uniforms: this.uniforms,
					vertexShader: shader.vertexShader,
					fragmentShader: shader.fragmentShader
				} );

			}

			this.fsQuad = new THREE.FullScreenQuad( this.material );

		}

		render( renderer, writeBuffer, readBuffer
			/*, deltaTime, maskActive */
		) {

			if ( this.uniforms[ this.textureID ] ) {

				this.uniforms[ this.textureID ].value = readBuffer.texture;

			}

			this.fsQuad.material = this.material;

			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( writeBuffer ); // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600

				if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
				this.fsQuad.render( renderer );

			}

		}

	}

	THREE.ShaderPass = ShaderPass;

} )();

// ---- UnrealBloomPass.js ----
( function () {

	/**
 * UnrealBloomPass is inspired by the bloom pass of Unreal Engine. It creates a
 * mip map chain of bloom textures and blurs them with different radii. Because
 * of the weighted combination of mips, and because larger blurs are done on
 * higher mips, this effect provides good quality and performance.
 *
 * Reference:
 * - https://docs.unrealengine.com/latest/INT/Engine/Rendering/PostProcessEffects/Bloom/
 */

	class UnrealBloomPass extends THREE.Pass {

		constructor( resolution, strength, radius, threshold ) {

			super();
			this.strength = strength !== undefined ? strength : 1;
			this.radius = radius;
			this.threshold = threshold;
			this.resolution = resolution !== undefined ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 ); // create color only once here, reuse it later inside the render function

			this.clearColor = new THREE.Color( 0, 0, 0 ); // render targets

			const pars = {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBAFormat
			};
			this.renderTargetsHorizontal = [];
			this.renderTargetsVertical = [];
			this.nMips = 5;
			let resx = Math.round( this.resolution.x / 2 );
			let resy = Math.round( this.resolution.y / 2 );
			this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy, pars );
			this.renderTargetBright.texture.name = 'UnrealBloomPass.bright';
			this.renderTargetBright.texture.generateMipmaps = false;

			for ( let i = 0; i < this.nMips; i ++ ) {

				const renderTargetHorizonal = new THREE.WebGLRenderTarget( resx, resy, pars );
				renderTargetHorizonal.texture.name = 'UnrealBloomPass.h' + i;
				renderTargetHorizonal.texture.generateMipmaps = false;
				this.renderTargetsHorizontal.push( renderTargetHorizonal );
				const renderTargetVertical = new THREE.WebGLRenderTarget( resx, resy, pars );
				renderTargetVertical.texture.name = 'UnrealBloomPass.v' + i;
				renderTargetVertical.texture.generateMipmaps = false;
				this.renderTargetsVertical.push( renderTargetVertical );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			} // luminosity high pass material


			if ( THREE.LuminosityHighPassShader === undefined ) console.error( 'THREE.UnrealBloomPass relies on THREE.LuminosityHighPassShader' );
			const highPassShader = THREE.LuminosityHighPassShader;
			this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );
			this.highPassUniforms[ 'luminosityThreshold' ].value = threshold;
			this.highPassUniforms[ 'smoothWidth' ].value = 0.01;
			this.materialHighPassFilter = new THREE.ShaderMaterial( {
				uniforms: this.highPassUniforms,
				vertexShader: highPassShader.vertexShader,
				fragmentShader: highPassShader.fragmentShader,
				defines: {}
			} ); // Gaussian Blur Materials

			this.separableBlurMaterials = [];
			const kernelSizeArray = [ 3, 5, 7, 9, 11 ];
			resx = Math.round( this.resolution.x / 2 );
			resy = Math.round( this.resolution.y / 2 );

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.separableBlurMaterials.push( this.getSeperableBlurMaterial( kernelSizeArray[ i ] ) );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			} // Composite material


			this.compositeMaterial = this.getCompositeMaterial( this.nMips );
			this.compositeMaterial.uniforms[ 'blurTexture1' ].value = this.renderTargetsVertical[ 0 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture2' ].value = this.renderTargetsVertical[ 1 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture3' ].value = this.renderTargetsVertical[ 2 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture4' ].value = this.renderTargetsVertical[ 3 ].texture;
			this.compositeMaterial.uniforms[ 'blurTexture5' ].value = this.renderTargetsVertical[ 4 ].texture;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = 0.1;
			this.compositeMaterial.needsUpdate = true;
			const bloomFactors = [ 1.0, 0.8, 0.6, 0.4, 0.2 ];
			this.compositeMaterial.uniforms[ 'bloomFactors' ].value = bloomFactors;
			this.bloomTintColors = [ new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ), new THREE.Vector3( 1, 1, 1 ) ];
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors; // copy material

			if ( THREE.CopyShader === undefined ) {

				console.error( 'THREE.UnrealBloomPass relies on THREE.CopyShader' );

			}

			const copyShader = THREE.CopyShader;
			this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
			this.copyUniforms[ 'opacity' ].value = 1.0;
			this.materialCopy = new THREE.ShaderMaterial( {
				uniforms: this.copyUniforms,
				vertexShader: copyShader.vertexShader,
				fragmentShader: copyShader.fragmentShader,
				blending: THREE.AdditiveBlending,
				depthTest: false,
				depthWrite: false,
				transparent: true
			} );
			this.enabled = true;
			this.needsSwap = false;
			this._oldClearColor = new THREE.Color();
			this.oldClearAlpha = 1;
			this.basic = new THREE.MeshBasicMaterial();
			this.fsQuad = new THREE.FullScreenQuad( null );

		}

		dispose() {

			for ( let i = 0; i < this.renderTargetsHorizontal.length; i ++ ) {

				this.renderTargetsHorizontal[ i ].dispose();

			}

			for ( let i = 0; i < this.renderTargetsVertical.length; i ++ ) {

				this.renderTargetsVertical[ i ].dispose();

			}

			this.renderTargetBright.dispose();

		}

		setSize( width, height ) {

			let resx = Math.round( width / 2 );
			let resy = Math.round( height / 2 );
			this.renderTargetBright.setSize( resx, resy );

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.renderTargetsHorizontal[ i ].setSize( resx, resy );
				this.renderTargetsVertical[ i ].setSize( resx, resy );
				this.separableBlurMaterials[ i ].uniforms[ 'texSize' ].value = new THREE.Vector2( resx, resy );
				resx = Math.round( resx / 2 );
				resy = Math.round( resy / 2 );

			}

		}

		render( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

			renderer.getClearColor( this._oldClearColor );
			this.oldClearAlpha = renderer.getClearAlpha();
			const oldAutoClear = renderer.autoClear;
			renderer.autoClear = false;
			renderer.setClearColor( this.clearColor, 0 );
			if ( maskActive ) renderer.state.buffers.stencil.setTest( false ); // Render input to screen

			if ( this.renderToScreen ) {

				this.fsQuad.material = this.basic;
				this.basic.map = readBuffer.texture;
				renderer.setRenderTarget( null );
				renderer.clear();
				this.fsQuad.render( renderer );

			} // 1. Extract Bright Areas


			this.highPassUniforms[ 'tDiffuse' ].value = readBuffer.texture;
			this.highPassUniforms[ 'luminosityThreshold' ].value = this.threshold;
			this.fsQuad.material = this.materialHighPassFilter;
			renderer.setRenderTarget( this.renderTargetBright );
			renderer.clear();
			this.fsQuad.render( renderer ); // 2. Blur All the mips progressively

			let inputRenderTarget = this.renderTargetBright;

			for ( let i = 0; i < this.nMips; i ++ ) {

				this.fsQuad.material = this.separableBlurMaterials[ i ];
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = inputRenderTarget.texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionX;
				renderer.setRenderTarget( this.renderTargetsHorizontal[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				this.separableBlurMaterials[ i ].uniforms[ 'colorTexture' ].value = this.renderTargetsHorizontal[ i ].texture;
				this.separableBlurMaterials[ i ].uniforms[ 'direction' ].value = UnrealBloomPass.BlurDirectionY;
				renderer.setRenderTarget( this.renderTargetsVertical[ i ] );
				renderer.clear();
				this.fsQuad.render( renderer );
				inputRenderTarget = this.renderTargetsVertical[ i ];

			} // Composite All the mips


			this.fsQuad.material = this.compositeMaterial;
			this.compositeMaterial.uniforms[ 'bloomStrength' ].value = this.strength;
			this.compositeMaterial.uniforms[ 'bloomRadius' ].value = this.radius;
			this.compositeMaterial.uniforms[ 'bloomTintColors' ].value = this.bloomTintColors;
			renderer.setRenderTarget( this.renderTargetsHorizontal[ 0 ] );
			renderer.clear();
			this.fsQuad.render( renderer ); // Blend it additively over the input texture

			this.fsQuad.material = this.materialCopy;
			this.copyUniforms[ 'tDiffuse' ].value = this.renderTargetsHorizontal[ 0 ].texture;
			if ( maskActive ) renderer.state.buffers.stencil.setTest( true );

			if ( this.renderToScreen ) {

				renderer.setRenderTarget( null );
				this.fsQuad.render( renderer );

			} else {

				renderer.setRenderTarget( readBuffer );
				this.fsQuad.render( renderer );

			} // Restore renderer settings


			renderer.setClearColor( this._oldClearColor, this.oldClearAlpha );
			renderer.autoClear = oldAutoClear;

		}

		getSeperableBlurMaterial( kernelRadius ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'KERNEL_RADIUS': kernelRadius,
					'SIGMA': kernelRadius
				},
				uniforms: {
					'colorTexture': {
						value: null
					},
					'texSize': {
						value: new THREE.Vector2( 0.5, 0.5 )
					},
					'direction': {
						value: new THREE.Vector2( 0.5, 0.5 )
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 texSize;
				uniform vec2 direction;

				float gaussianPdf(in float x, in float sigma) {
					return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
				}
				void main() {
					vec2 invSize = 1.0 / texSize;
					float fSigma = float(SIGMA);
					float weightSum = gaussianPdf(0.0, fSigma);
					vec3 diffuseSum = texture2D( colorTexture, vUv).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianPdf(x, fSigma);
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`
			} );

		}

		getCompositeMaterial( nMips ) {

			return new THREE.ShaderMaterial( {
				defines: {
					'NUM_MIPS': nMips
				},
				uniforms: {
					'blurTexture1': {
						value: null
					},
					'blurTexture2': {
						value: null
					},
					'blurTexture3': {
						value: null
					},
					'blurTexture4': {
						value: null
					},
					'blurTexture5': {
						value: null
					},
					'dirtTexture': {
						value: null
					},
					'bloomStrength': {
						value: 1.0
					},
					'bloomFactors': {
						value: null
					},
					'bloomTintColors': {
						value: null
					},
					'bloomRadius': {
						value: 0.0
					}
				},
				vertexShader: `varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,
				fragmentShader: `varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform sampler2D dirtTexture;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`
			} );

		}

	}

	UnrealBloomPass.BlurDirectionX = new THREE.Vector2( 1.0, 0.0 );
	UnrealBloomPass.BlurDirectionY = new THREE.Vector2( 0.0, 1.0 );

	THREE.UnrealBloomPass = UnrealBloomPass;

} )();

// ---- SkeletonUtils.js ----
( function () {

	class SkeletonUtils {

		static retarget( target, source, options = {} ) {

			const pos = new THREE.Vector3(),
				quat = new THREE.Quaternion(),
				scale = new THREE.Vector3(),
				bindBoneMatrix = new THREE.Matrix4(),
				relativeMatrix = new THREE.Matrix4(),
				globalMatrix = new THREE.Matrix4();
			options.preserveMatrix = options.preserveMatrix !== undefined ? options.preserveMatrix : true;
			options.preservePosition = options.preservePosition !== undefined ? options.preservePosition : true;
			options.preserveHipPosition = options.preserveHipPosition !== undefined ? options.preserveHipPosition : false;
			options.useTargetMatrix = options.useTargetMatrix !== undefined ? options.useTargetMatrix : false;
			options.hip = options.hip !== undefined ? options.hip : 'hip';
			options.names = options.names || {};
			const sourceBones = source.isObject3D ? source.skeleton.bones : this.getBones( source ),
				bones = target.isObject3D ? target.skeleton.bones : this.getBones( target );
			let bindBones, bone, name, boneTo, bonesPosition; // reset bones

			if ( target.isObject3D ) {

				target.skeleton.pose();

			} else {

				options.useTargetMatrix = true;
				options.preserveMatrix = false;

			}

			if ( options.preservePosition ) {

				bonesPosition = [];

				for ( let i = 0; i < bones.length; i ++ ) {

					bonesPosition.push( bones[ i ].position.clone() );

				}

			}

			if ( options.preserveMatrix ) {

				// reset matrix
				target.updateMatrixWorld();
				target.matrixWorld.identity(); // reset children matrix

				for ( let i = 0; i < target.children.length; ++ i ) {

					target.children[ i ].updateMatrixWorld( true );

				}

			}

			if ( options.offsets ) {

				bindBones = [];

				for ( let i = 0; i < bones.length; ++ i ) {

					bone = bones[ i ];
					name = options.names[ bone.name ] || bone.name;

					if ( options.offsets && options.offsets[ name ] ) {

						bone.matrix.multiply( options.offsets[ name ] );
						bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
						bone.updateMatrixWorld();

					}

					bindBones.push( bone.matrixWorld.clone() );

				}

			}

			for ( let i = 0; i < bones.length; ++ i ) {

				bone = bones[ i ];
				name = options.names[ bone.name ] || bone.name;
				boneTo = this.getBoneByName( name, sourceBones );
				globalMatrix.copy( bone.matrixWorld );

				if ( boneTo ) {

					boneTo.updateMatrixWorld();

					if ( options.useTargetMatrix ) {

						relativeMatrix.copy( boneTo.matrixWorld );

					} else {

						relativeMatrix.copy( target.matrixWorld ).invert();
						relativeMatrix.multiply( boneTo.matrixWorld );

					} // ignore scale to extract rotation


					scale.setFromMatrixScale( relativeMatrix );
					relativeMatrix.scale( scale.set( 1 / scale.x, 1 / scale.y, 1 / scale.z ) ); // apply to global matrix

					globalMatrix.makeRotationFromQuaternion( quat.setFromRotationMatrix( relativeMatrix ) );

					if ( target.isObject3D ) {

						const boneIndex = bones.indexOf( bone ),
							wBindMatrix = bindBones ? bindBones[ boneIndex ] : bindBoneMatrix.copy( target.skeleton.boneInverses[ boneIndex ] ).invert();
						globalMatrix.multiply( wBindMatrix );

					}

					globalMatrix.copyPosition( relativeMatrix );

				}

				if ( bone.parent && bone.parent.isBone ) {

					bone.matrix.copy( bone.parent.matrixWorld ).invert();
					bone.matrix.multiply( globalMatrix );

				} else {

					bone.matrix.copy( globalMatrix );

				}

				if ( options.preserveHipPosition && name === options.hip ) {

					bone.matrix.setPosition( pos.set( 0, bone.position.y, 0 ) );

				}

				bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
				bone.updateMatrixWorld();

			}

			if ( options.preservePosition ) {

				for ( let i = 0; i < bones.length; ++ i ) {

					bone = bones[ i ];
					name = options.names[ bone.name ] || bone.name;

					if ( name !== options.hip ) {

						bone.position.copy( bonesPosition[ i ] );

					}

				}

			}

			if ( options.preserveMatrix ) {

				// restore matrix
				target.updateMatrixWorld( true );

			}

		}

		static retargetClip( target, source, clip, options = {} ) {

			options.useFirstFramePosition = options.useFirstFramePosition !== undefined ? options.useFirstFramePosition : false;
			options.fps = options.fps !== undefined ? options.fps : 30;
			options.names = options.names || [];

			if ( ! source.isObject3D ) {

				source = this.getHelperFromSkeleton( source );

			}

			const numFrames = Math.round( clip.duration * ( options.fps / 1000 ) * 1000 ),
				delta = 1 / options.fps,
				convertedTracks = [],
				mixer = new THREE.AnimationMixer( source ),
				bones = this.getBones( target.skeleton ),
				boneDatas = [];
			let positionOffset, bone, boneTo, boneData, name;
			mixer.clipAction( clip ).play();
			mixer.update( 0 );
			source.updateMatrixWorld();

			for ( let i = 0; i < numFrames; ++ i ) {

				const time = i * delta;
				this.retarget( target, source, options );

				for ( let j = 0; j < bones.length; ++ j ) {

					name = options.names[ bones[ j ].name ] || bones[ j ].name;
					boneTo = this.getBoneByName( name, source.skeleton );

					if ( boneTo ) {

						bone = bones[ j ];
						boneData = boneDatas[ j ] = boneDatas[ j ] || {
							bone: bone
						};

						if ( options.hip === name ) {

							if ( ! boneData.pos ) {

								boneData.pos = {
									times: new Float32Array( numFrames ),
									values: new Float32Array( numFrames * 3 )
								};

							}

							if ( options.useFirstFramePosition ) {

								if ( i === 0 ) {

									positionOffset = bone.position.clone();

								}

								bone.position.sub( positionOffset );

							}

							boneData.pos.times[ i ] = time;
							bone.position.toArray( boneData.pos.values, i * 3 );

						}

						if ( ! boneData.quat ) {

							boneData.quat = {
								times: new Float32Array( numFrames ),
								values: new Float32Array( numFrames * 4 )
							};

						}

						boneData.quat.times[ i ] = time;
						bone.quaternion.toArray( boneData.quat.values, i * 4 );

					}

				}

				mixer.update( delta );
				source.updateMatrixWorld();

			}

			for ( let i = 0; i < boneDatas.length; ++ i ) {

				boneData = boneDatas[ i ];

				if ( boneData ) {

					if ( boneData.pos ) {

						convertedTracks.push( new THREE.VectorKeyframeTrack( '.bones[' + boneData.bone.name + '].position', boneData.pos.times, boneData.pos.values ) );

					}

					convertedTracks.push( new THREE.QuaternionKeyframeTrack( '.bones[' + boneData.bone.name + '].quaternion', boneData.quat.times, boneData.quat.values ) );

				}

			}

			mixer.uncacheAction( clip );
			return new THREE.AnimationClip( clip.name, - 1, convertedTracks );

		}

		static getHelperFromSkeleton( skeleton ) {

			const source = new THREE.SkeletonHelper( skeleton.bones[ 0 ] );
			source.skeleton = skeleton;
			return source;

		}

		static getSkeletonOffsets( target, source, options = {} ) {

			const targetParentPos = new THREE.Vector3(),
				targetPos = new THREE.Vector3(),
				sourceParentPos = new THREE.Vector3(),
				sourcePos = new THREE.Vector3(),
				targetDir = new THREE.Vector2(),
				sourceDir = new THREE.Vector2();
			options.hip = options.hip !== undefined ? options.hip : 'hip';
			options.names = options.names || {};

			if ( ! source.isObject3D ) {

				source = this.getHelperFromSkeleton( source );

			}

			const nameKeys = Object.keys( options.names ),
				nameValues = Object.values( options.names ),
				sourceBones = source.isObject3D ? source.skeleton.bones : this.getBones( source ),
				bones = target.isObject3D ? target.skeleton.bones : this.getBones( target ),
				offsets = [];
			let bone, boneTo, name, i;
			target.skeleton.pose();

			for ( i = 0; i < bones.length; ++ i ) {

				bone = bones[ i ];
				name = options.names[ bone.name ] || bone.name;
				boneTo = this.getBoneByName( name, sourceBones );

				if ( boneTo && name !== options.hip ) {

					const boneParent = this.getNearestBone( bone.parent, nameKeys ),
						boneToParent = this.getNearestBone( boneTo.parent, nameValues );
					boneParent.updateMatrixWorld();
					boneToParent.updateMatrixWorld();
					targetParentPos.setFromMatrixPosition( boneParent.matrixWorld );
					targetPos.setFromMatrixPosition( bone.matrixWorld );
					sourceParentPos.setFromMatrixPosition( boneToParent.matrixWorld );
					sourcePos.setFromMatrixPosition( boneTo.matrixWorld );
					targetDir.subVectors( new THREE.Vector2( targetPos.x, targetPos.y ), new THREE.Vector2( targetParentPos.x, targetParentPos.y ) ).normalize();
					sourceDir.subVectors( new THREE.Vector2( sourcePos.x, sourcePos.y ), new THREE.Vector2( sourceParentPos.x, sourceParentPos.y ) ).normalize();
					const laterialAngle = targetDir.angle() - sourceDir.angle();
					const offset = new THREE.Matrix4().makeRotationFromEuler( new THREE.Euler( 0, 0, laterialAngle ) );
					bone.matrix.multiply( offset );
					bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
					bone.updateMatrixWorld();
					offsets[ name ] = offset;

				}

			}

			return offsets;

		}

		static renameBones( skeleton, names ) {

			const bones = this.getBones( skeleton );

			for ( let i = 0; i < bones.length; ++ i ) {

				const bone = bones[ i ];

				if ( names[ bone.name ] ) {

					bone.name = names[ bone.name ];

				}

			}

			return this;

		}

		static getBones( skeleton ) {

			return Array.isArray( skeleton ) ? skeleton : skeleton.bones;

		}

		static getBoneByName( name, skeleton ) {

			for ( let i = 0, bones = this.getBones( skeleton ); i < bones.length; i ++ ) {

				if ( name === bones[ i ].name ) return bones[ i ];

			}

		}

		static getNearestBone( bone, names ) {

			while ( bone.isBone ) {

				if ( names.indexOf( bone.name ) !== - 1 ) {

					return bone;

				}

				bone = bone.parent;

			}

		}

		static findBoneTrackData( name, tracks ) {

			const regexp = /\[(.*)\]\.(.*)/,
				result = {
					name: name
				};

			for ( let i = 0; i < tracks.length; ++ i ) {

				// 1 is track name
				// 2 is track type
				const trackData = regexp.exec( tracks[ i ].name );

				if ( trackData && name === trackData[ 1 ] ) {

					result[ trackData[ 2 ] ] = i;

				}

			}

			return result;

		}

		static getEqualsBonesNames( skeleton, targetSkeleton ) {

			const sourceBones = this.getBones( skeleton ),
				targetBones = this.getBones( targetSkeleton ),
				bones = [];

			search: for ( let i = 0; i < sourceBones.length; i ++ ) {

				const boneName = sourceBones[ i ].name;

				for ( let j = 0; j < targetBones.length; j ++ ) {

					if ( boneName === targetBones[ j ].name ) {

						bones.push( boneName );
						continue search;

					}

				}

			}

			return bones;

		}

		static clone( source ) {

			const sourceLookup = new Map();
			const cloneLookup = new Map();
			const clone = source.clone();
			parallelTraverse( source, clone, function ( sourceNode, clonedNode ) {

				sourceLookup.set( clonedNode, sourceNode );
				cloneLookup.set( sourceNode, clonedNode );

			} );
			clone.traverse( function ( node ) {

				if ( ! node.isSkinnedMesh ) return;
				const clonedMesh = node;
				const sourceMesh = sourceLookup.get( node );
				const sourceBones = sourceMesh.skeleton.bones;
				clonedMesh.skeleton = sourceMesh.skeleton.clone();
				clonedMesh.bindMatrix.copy( sourceMesh.bindMatrix );
				clonedMesh.skeleton.bones = sourceBones.map( function ( bone ) {

					return cloneLookup.get( bone );

				} );
				clonedMesh.bind( clonedMesh.skeleton, clonedMesh.bindMatrix );

			} );
			return clone;

		}

	}

	function parallelTraverse( a, b, callback ) {

		callback( a, b );

		for ( let i = 0; i < a.children.length; i ++ ) {

			parallelTraverse( a.children[ i ], b.children[ i ], callback );

		}

	}

	THREE.SkeletonUtils = SkeletonUtils;

} )();

// ---- RoomEnvironment.js ----
( function () {

	/**
 * https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/three-components/EnvironmentScene.ts
 */

	class RoomEnvironment extends THREE.Scene {

		constructor() {

			super();
			const geometry = new THREE.BoxGeometry();
			geometry.deleteAttribute( 'uv' );
			const roomMaterial = new THREE.MeshStandardMaterial( {
				side: THREE.BackSide
			} );
			const boxMaterial = new THREE.MeshStandardMaterial();
			const mainLight = new THREE.PointLight( 0xffffff, 5.0, 28, 2 );
			mainLight.position.set( 0.418, 16.199, 0.300 );
			this.add( mainLight );
			const room = new THREE.Mesh( geometry, roomMaterial );
			room.position.set( - 0.757, 13.219, 0.717 );
			room.scale.set( 31.713, 28.305, 28.591 );
			this.add( room );
			const box1 = new THREE.Mesh( geometry, boxMaterial );
			box1.position.set( - 10.906, 2.009, 1.846 );
			box1.rotation.set( 0, - 0.195, 0 );
			box1.scale.set( 2.328, 7.905, 4.651 );
			this.add( box1 );
			const box2 = new THREE.Mesh( geometry, boxMaterial );
			box2.position.set( - 5.607, - 0.754, - 0.758 );
			box2.rotation.set( 0, 0.994, 0 );
			box2.scale.set( 1.970, 1.534, 3.955 );
			this.add( box2 );
			const box3 = new THREE.Mesh( geometry, boxMaterial );
			box3.position.set( 6.167, 0.857, 7.803 );
			box3.rotation.set( 0, 0.561, 0 );
			box3.scale.set( 3.927, 6.285, 3.687 );
			this.add( box3 );
			const box4 = new THREE.Mesh( geometry, boxMaterial );
			box4.position.set( - 2.017, 0.018, 6.124 );
			box4.rotation.set( 0, 0.333, 0 );
			box4.scale.set( 2.002, 4.566, 2.064 );
			this.add( box4 );
			const box5 = new THREE.Mesh( geometry, boxMaterial );
			box5.position.set( 2.291, - 0.756, - 2.621 );
			box5.rotation.set( 0, - 0.286, 0 );
			box5.scale.set( 1.546, 1.552, 1.496 );
			this.add( box5 );
			const box6 = new THREE.Mesh( geometry, boxMaterial );
			box6.position.set( - 2.193, - 0.369, - 5.547 );
			box6.rotation.set( 0, 0.516, 0 );
			box6.scale.set( 3.875, 3.487, 2.986 );
			this.add( box6 ); // -x right

			const light1 = new THREE.Mesh( geometry, createAreaLightMaterial( 50 ) );
			light1.position.set( - 16.116, 14.37, 8.208 );
			light1.scale.set( 0.1, 2.428, 2.739 );
			this.add( light1 ); // -x left

			const light2 = new THREE.Mesh( geometry, createAreaLightMaterial( 50 ) );
			light2.position.set( - 16.109, 18.021, - 8.207 );
			light2.scale.set( 0.1, 2.425, 2.751 );
			this.add( light2 ); // +x

			const light3 = new THREE.Mesh( geometry, createAreaLightMaterial( 17 ) );
			light3.position.set( 14.904, 12.198, - 1.832 );
			light3.scale.set( 0.15, 4.265, 6.331 );
			this.add( light3 ); // +z

			const light4 = new THREE.Mesh( geometry, createAreaLightMaterial( 43 ) );
			light4.position.set( - 0.462, 8.89, 14.520 );
			light4.scale.set( 4.38, 5.441, 0.088 );
			this.add( light4 ); // -z

			const light5 = new THREE.Mesh( geometry, createAreaLightMaterial( 20 ) );
			light5.position.set( 3.235, 11.486, - 12.541 );
			light5.scale.set( 2.5, 2.0, 0.1 );
			this.add( light5 ); // +y

			const light6 = new THREE.Mesh( geometry, createAreaLightMaterial( 100 ) );
			light6.position.set( 0.0, 20.0, 0.0 );
			light6.scale.set( 1.0, 0.1, 1.0 );
			this.add( light6 );

		}

	}

	function createAreaLightMaterial( intensity ) {

		const material = new THREE.MeshBasicMaterial();
		material.color.setScalar( intensity );
		return material;

	}

	THREE.RoomEnvironment = RoomEnvironment;

} )();

// ---- BufferGeometryUtils.js ----
( function () {

	class BufferGeometryUtils {

		static computeTangents( geometry ) {

			geometry.computeTangents();
			console.warn( 'THREE.BufferGeometryUtils: .computeTangents() has been removed. Use THREE.BufferGeometry.computeTangents() instead.' );

		}
		/**
   * @param  {Array<BufferGeometry>} geometries
   * @param  {Boolean} useGroups
   * @return {BufferGeometry}
   */


		static mergeBufferGeometries( geometries, useGroups = false ) {

			const isIndexed = geometries[ 0 ].index !== null;
			const attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
			const morphAttributesUsed = new Set( Object.keys( geometries[ 0 ].morphAttributes ) );
			const attributes = {};
			const morphAttributes = {};
			const morphTargetsRelative = geometries[ 0 ].morphTargetsRelative;
			const mergedGeometry = new THREE.BufferGeometry();
			let offset = 0;

			for ( let i = 0; i < geometries.length; ++ i ) {

				const geometry = geometries[ i ];
				let attributesCount = 0; // ensure that all geometries are indexed, or none

				if ( isIndexed !== ( geometry.index !== null ) ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.' );
					return null;

				} // gather attributes, exit early if they're different


				for ( const name in geometry.attributes ) {

					if ( ! attributesUsed.has( name ) ) {

						console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.' );
						return null;

					}

					if ( attributes[ name ] === undefined ) attributes[ name ] = [];
					attributes[ name ].push( geometry.attributes[ name ] );
					attributesCount ++;

				} // ensure geometries have the same number of attributes


				if ( attributesCount !== attributesUsed.size ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. Make sure all geometries have the same number of attributes.' );
					return null;

				} // gather morph attributes, exit early if they're different


				if ( morphTargetsRelative !== geometry.morphTargetsRelative ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. .morphTargetsRelative must be consistent throughout all geometries.' );
					return null;

				}

				for ( const name in geometry.morphAttributes ) {

					if ( ! morphAttributesUsed.has( name ) ) {

						console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '.  .morphAttributes must be consistent throughout all geometries.' );
						return null;

					}

					if ( morphAttributes[ name ] === undefined ) morphAttributes[ name ] = [];
					morphAttributes[ name ].push( geometry.morphAttributes[ name ] );

				} // gather .userData


				mergedGeometry.userData.mergedUserData = mergedGeometry.userData.mergedUserData || [];
				mergedGeometry.userData.mergedUserData.push( geometry.userData );

				if ( useGroups ) {

					let count;

					if ( isIndexed ) {

						count = geometry.index.count;

					} else if ( geometry.attributes.position !== undefined ) {

						count = geometry.attributes.position.count;

					} else {

						console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index ' + i + '. The geometry must have either an index or a position attribute' );
						return null;

					}

					mergedGeometry.addGroup( offset, count, i );
					offset += count;

				}

			} // merge indices


			if ( isIndexed ) {

				let indexOffset = 0;
				const mergedIndex = [];

				for ( let i = 0; i < geometries.length; ++ i ) {

					const index = geometries[ i ].index;

					for ( let j = 0; j < index.count; ++ j ) {

						mergedIndex.push( index.getX( j ) + indexOffset );

					}

					indexOffset += geometries[ i ].attributes.position.count;

				}

				mergedGeometry.setIndex( mergedIndex );

			} // merge attributes


			for ( const name in attributes ) {

				const mergedAttribute = this.mergeBufferAttributes( attributes[ name ] );

				if ( ! mergedAttribute ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the ' + name + ' attribute.' );
					return null;

				}

				mergedGeometry.setAttribute( name, mergedAttribute );

			} // merge morph attributes


			for ( const name in morphAttributes ) {

				const numMorphTargets = morphAttributes[ name ][ 0 ].length;
				if ( numMorphTargets === 0 ) break;
				mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
				mergedGeometry.morphAttributes[ name ] = [];

				for ( let i = 0; i < numMorphTargets; ++ i ) {

					const morphAttributesToMerge = [];

					for ( let j = 0; j < morphAttributes[ name ].length; ++ j ) {

						morphAttributesToMerge.push( morphAttributes[ name ][ j ][ i ] );

					}

					const mergedMorphAttribute = this.mergeBufferAttributes( morphAttributesToMerge );

					if ( ! mergedMorphAttribute ) {

						console.error( 'THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the ' + name + ' morphAttribute.' );
						return null;

					}

					mergedGeometry.morphAttributes[ name ].push( mergedMorphAttribute );

				}

			}

			return mergedGeometry;

		}
		/**
   * @param {Array<BufferAttribute>} attributes
   * @return {BufferAttribute}
   */


		static mergeBufferAttributes( attributes ) {

			let TypedArray;
			let itemSize;
			let normalized;
			let arrayLength = 0;

			for ( let i = 0; i < attributes.length; ++ i ) {

				const attribute = attributes[ i ];

				if ( attribute.isInterleavedBufferAttribute ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. InterleavedBufferAttributes are not supported.' );
					return null;

				}

				if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;

				if ( TypedArray !== attribute.array.constructor ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. THREE.BufferAttribute.array must be of consistent array types across matching attributes.' );
					return null;

				}

				if ( itemSize === undefined ) itemSize = attribute.itemSize;

				if ( itemSize !== attribute.itemSize ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. THREE.BufferAttribute.itemSize must be consistent across matching attributes.' );
					return null;

				}

				if ( normalized === undefined ) normalized = attribute.normalized;

				if ( normalized !== attribute.normalized ) {

					console.error( 'THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. THREE.BufferAttribute.normalized must be consistent across matching attributes.' );
					return null;

				}

				arrayLength += attribute.array.length;

			}

			const array = new TypedArray( arrayLength );
			let offset = 0;

			for ( let i = 0; i < attributes.length; ++ i ) {

				array.set( attributes[ i ].array, offset );
				offset += attributes[ i ].array.length;

			}

			return new THREE.BufferAttribute( array, itemSize, normalized );

		}
		/**
   * @param {Array<BufferAttribute>} attributes
   * @return {Array<InterleavedBufferAttribute>}
   */


		static interleaveAttributes( attributes ) {

			// Interleaves the provided attributes into an THREE.InterleavedBuffer and returns
			// a set of InterleavedBufferAttributes for each attribute
			let TypedArray;
			let arrayLength = 0;
			let stride = 0; // calculate the the length and type of the interleavedBuffer

			for ( let i = 0, l = attributes.length; i < l; ++ i ) {

				const attribute = attributes[ i ];
				if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;

				if ( TypedArray !== attribute.array.constructor ) {

					console.error( 'AttributeBuffers of different types cannot be interleaved' );
					return null;

				}

				arrayLength += attribute.array.length;
				stride += attribute.itemSize;

			} // Create the set of buffer attributes


			const interleavedBuffer = new THREE.InterleavedBuffer( new TypedArray( arrayLength ), stride );
			let offset = 0;
			const res = [];
			const getters = [ 'getX', 'getY', 'getZ', 'getW' ];
			const setters = [ 'setX', 'setY', 'setZ', 'setW' ];

			for ( let j = 0, l = attributes.length; j < l; j ++ ) {

				const attribute = attributes[ j ];
				const itemSize = attribute.itemSize;
				const count = attribute.count;
				const iba = new THREE.InterleavedBufferAttribute( interleavedBuffer, itemSize, offset, attribute.normalized );
				res.push( iba );
				offset += itemSize; // Move the data for each attribute into the new interleavedBuffer
				// at the appropriate offset

				for ( let c = 0; c < count; c ++ ) {

					for ( let k = 0; k < itemSize; k ++ ) {

						iba[ setters[ k ] ]( c, attribute[ getters[ k ] ]( c ) );

					}

				}

			}

			return res;

		}
		/**
   * @param {Array<BufferGeometry>} geometry
   * @return {number}
   */


		static estimateBytesUsed( geometry ) {

			// Return the estimated memory used by this geometry in bytes
			// Calculate using itemSize, count, and BYTES_PER_ELEMENT to account
			// for InterleavedBufferAttributes.
			let mem = 0;

			for ( const name in geometry.attributes ) {

				const attr = geometry.getAttribute( name );
				mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;

			}

			const indices = geometry.getIndex();
			mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
			return mem;

		}
		/**
   * @param {BufferGeometry} geometry
   * @param {number} tolerance
   * @return {BufferGeometry>}
   */


		static mergeVertices( geometry, tolerance = 1e-4 ) {

			tolerance = Math.max( tolerance, Number.EPSILON ); // Generate an index buffer if the geometry doesn't have one, or optimize it
			// if it's already available.

			const hashToIndex = {};
			const indices = geometry.getIndex();
			const positions = geometry.getAttribute( 'position' );
			const vertexCount = indices ? indices.count : positions.count; // next value for triangle indices

			let nextIndex = 0; // attributes and new attribute arrays

			const attributeNames = Object.keys( geometry.attributes );
			const attrArrays = {};
			const morphAttrsArrays = {};
			const newIndices = [];
			const getters = [ 'getX', 'getY', 'getZ', 'getW' ]; // initialize the arrays

			for ( let i = 0, l = attributeNames.length; i < l; i ++ ) {

				const name = attributeNames[ i ];
				attrArrays[ name ] = [];
				const morphAttr = geometry.morphAttributes[ name ];

				if ( morphAttr ) {

					morphAttrsArrays[ name ] = new Array( morphAttr.length ).fill().map( () => [] );

				}

			} // convert the error tolerance to an amount of decimal places to truncate to


			const decimalShift = Math.log10( 1 / tolerance );
			const shiftMultiplier = Math.pow( 10, decimalShift );

			for ( let i = 0; i < vertexCount; i ++ ) {

				const index = indices ? indices.getX( i ) : i; // Generate a hash for the vertex attributes at the current index 'i'

				let hash = '';

				for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

					const name = attributeNames[ j ];
					const attribute = geometry.getAttribute( name );
					const itemSize = attribute.itemSize;

					for ( let k = 0; k < itemSize; k ++ ) {

						// double tilde truncates the decimal value
						hash += `${~ ~ ( attribute[ getters[ k ] ]( index ) * shiftMultiplier )},`;

					}

				} // Add another reference to the vertex if it's already
				// used by another index


				if ( hash in hashToIndex ) {

					newIndices.push( hashToIndex[ hash ] );

				} else {

					// copy data to the new index in the attribute arrays
					for ( let j = 0, l = attributeNames.length; j < l; j ++ ) {

						const name = attributeNames[ j ];
						const attribute = geometry.getAttribute( name );
						const morphAttr = geometry.morphAttributes[ name ];
						const itemSize = attribute.itemSize;
						const newarray = attrArrays[ name ];
						const newMorphArrays = morphAttrsArrays[ name ];

						for ( let k = 0; k < itemSize; k ++ ) {

							const getterFunc = getters[ k ];
							newarray.push( attribute[ getterFunc ]( index ) );

							if ( morphAttr ) {

								for ( let m = 0, ml = morphAttr.length; m < ml; m ++ ) {

									newMorphArrays[ m ].push( morphAttr[ m ][ getterFunc ]( index ) );

								}

							}

						}

					}

					hashToIndex[ hash ] = nextIndex;
					newIndices.push( nextIndex );
					nextIndex ++;

				}

			} // Generate typed arrays from new attribute arrays and update
			// the attributeBuffers


			const result = geometry.clone();

			for ( let i = 0, l = attributeNames.length; i < l; i ++ ) {

				const name = attributeNames[ i ];
				const oldAttribute = geometry.getAttribute( name );
				const buffer = new oldAttribute.array.constructor( attrArrays[ name ] );
				const attribute = new THREE.BufferAttribute( buffer, oldAttribute.itemSize, oldAttribute.normalized );
				result.setAttribute( name, attribute ); // Update the attribute arrays

				if ( name in morphAttrsArrays ) {

					for ( let j = 0; j < morphAttrsArrays[ name ].length; j ++ ) {

						const oldMorphAttribute = geometry.morphAttributes[ name ][ j ];
						const buffer = new oldMorphAttribute.array.constructor( morphAttrsArrays[ name ][ j ] );
						const morphAttribute = new THREE.BufferAttribute( buffer, oldMorphAttribute.itemSize, oldMorphAttribute.normalized );
						result.morphAttributes[ name ][ j ] = morphAttribute;

					}

				}

			} // indices


			result.setIndex( newIndices );
			return result;

		}
		/**
   * @param {BufferGeometry} geometry
   * @param {number} drawMode
   * @return {BufferGeometry>}
   */


		static toTrianglesDrawMode( geometry, drawMode ) {

			if ( drawMode === THREE.TrianglesDrawMode ) {

				console.warn( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.' );
				return geometry;

			}

			if ( drawMode === THREE.TriangleFanDrawMode || drawMode === THREE.TriangleStripDrawMode ) {

				let index = geometry.getIndex(); // generate index if not present

				if ( index === null ) {

					const indices = [];
					const position = geometry.getAttribute( 'position' );

					if ( position !== undefined ) {

						for ( let i = 0; i < position.count; i ++ ) {

							indices.push( i );

						}

						geometry.setIndex( indices );
						index = geometry.getIndex();

					} else {

						console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.' );
						return geometry;

					}

				} //


				const numberOfTriangles = index.count - 2;
				const newIndices = [];

				if ( drawMode === THREE.TriangleFanDrawMode ) {

					// gl.TRIANGLE_FAN
					for ( let i = 1; i <= numberOfTriangles; i ++ ) {

						newIndices.push( index.getX( 0 ) );
						newIndices.push( index.getX( i ) );
						newIndices.push( index.getX( i + 1 ) );

					}

				} else {

					// gl.TRIANGLE_STRIP
					for ( let i = 0; i < numberOfTriangles; i ++ ) {

						if ( i % 2 === 0 ) {

							newIndices.push( index.getX( i ) );
							newIndices.push( index.getX( i + 1 ) );
							newIndices.push( index.getX( i + 2 ) );

						} else {

							newIndices.push( index.getX( i + 2 ) );
							newIndices.push( index.getX( i + 1 ) );
							newIndices.push( index.getX( i ) );

						}

					}

				}

				if ( newIndices.length / 3 !== numberOfTriangles ) {

					console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.' );

				} // build final geometry


				const newGeometry = geometry.clone();
				newGeometry.setIndex( newIndices );
				newGeometry.clearGroups();
				return newGeometry;

			} else {

				console.error( 'THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:', drawMode );
				return geometry;

			}

		}
		/**
   * Calculates the morphed attributes of a morphed/skinned THREE.BufferGeometry.
   * Helpful for Raytracing or Decals.
   * @param {Mesh | Line | Points} object An instance of Mesh, Line or Points.
   * @return {Object} An Object with original position/normal attributes and morphed ones.
   */


		static computeMorphedAttributes( object ) {

			if ( object.geometry.isBufferGeometry !== true ) {

				console.error( 'THREE.BufferGeometryUtils: Geometry is not of type THREE.BufferGeometry.' );
				return null;

			}

			const _vA = new THREE.Vector3();

			const _vB = new THREE.Vector3();

			const _vC = new THREE.Vector3();

			const _tempA = new THREE.Vector3();

			const _tempB = new THREE.Vector3();

			const _tempC = new THREE.Vector3();

			const _morphA = new THREE.Vector3();

			const _morphB = new THREE.Vector3();

			const _morphC = new THREE.Vector3();

			function _calculateMorphedAttributeData( object, material, attribute, morphAttribute, morphTargetsRelative, a, b, c, modifiedAttributeArray ) {

				_vA.fromBufferAttribute( attribute, a );

				_vB.fromBufferAttribute( attribute, b );

				_vC.fromBufferAttribute( attribute, c );

				const morphInfluences = object.morphTargetInfluences;

				if ( material.morphTargets && morphAttribute && morphInfluences ) {

					_morphA.set( 0, 0, 0 );

					_morphB.set( 0, 0, 0 );

					_morphC.set( 0, 0, 0 );

					for ( let i = 0, il = morphAttribute.length; i < il; i ++ ) {

						const influence = morphInfluences[ i ];
						const morph = morphAttribute[ i ];
						if ( influence === 0 ) continue;

						_tempA.fromBufferAttribute( morph, a );

						_tempB.fromBufferAttribute( morph, b );

						_tempC.fromBufferAttribute( morph, c );

						if ( morphTargetsRelative ) {

							_morphA.addScaledVector( _tempA, influence );

							_morphB.addScaledVector( _tempB, influence );

							_morphC.addScaledVector( _tempC, influence );

						} else {

							_morphA.addScaledVector( _tempA.sub( _vA ), influence );

							_morphB.addScaledVector( _tempB.sub( _vB ), influence );

							_morphC.addScaledVector( _tempC.sub( _vC ), influence );

						}

					}

					_vA.add( _morphA );

					_vB.add( _morphB );

					_vC.add( _morphC );

				}

				if ( object.isSkinnedMesh ) {

					object.boneTransform( a, _vA );
					object.boneTransform( b, _vB );
					object.boneTransform( c, _vC );

				}

				modifiedAttributeArray[ a * 3 + 0 ] = _vA.x;
				modifiedAttributeArray[ a * 3 + 1 ] = _vA.y;
				modifiedAttributeArray[ a * 3 + 2 ] = _vA.z;
				modifiedAttributeArray[ b * 3 + 0 ] = _vB.x;
				modifiedAttributeArray[ b * 3 + 1 ] = _vB.y;
				modifiedAttributeArray[ b * 3 + 2 ] = _vB.z;
				modifiedAttributeArray[ c * 3 + 0 ] = _vC.x;
				modifiedAttributeArray[ c * 3 + 1 ] = _vC.y;
				modifiedAttributeArray[ c * 3 + 2 ] = _vC.z;

			}

			const geometry = object.geometry;
			const material = object.material;
			let a, b, c;
			const index = geometry.index;
			const positionAttribute = geometry.attributes.position;
			const morphPosition = geometry.morphAttributes.position;
			const morphTargetsRelative = geometry.morphTargetsRelative;
			const normalAttribute = geometry.attributes.normal;
			const morphNormal = geometry.morphAttributes.position;
			const groups = geometry.groups;
			const drawRange = geometry.drawRange;
			let i, j, il, jl;
			let group, groupMaterial;
			let start, end;
			const modifiedPosition = new Float32Array( positionAttribute.count * positionAttribute.itemSize );
			const modifiedNormal = new Float32Array( normalAttribute.count * normalAttribute.itemSize );

			if ( index !== null ) {

				// indexed buffer geometry
				if ( Array.isArray( material ) ) {

					for ( i = 0, il = groups.length; i < il; i ++ ) {

						group = groups[ i ];
						groupMaterial = material[ group.materialIndex ];
						start = Math.max( group.start, drawRange.start );
						end = Math.min( group.start + group.count, drawRange.start + drawRange.count );

						for ( j = start, jl = end; j < jl; j += 3 ) {

							a = index.getX( j );
							b = index.getX( j + 1 );
							c = index.getX( j + 2 );

							_calculateMorphedAttributeData( object, groupMaterial, positionAttribute, morphPosition, morphTargetsRelative, a, b, c, modifiedPosition );

							_calculateMorphedAttributeData( object, groupMaterial, normalAttribute, morphNormal, morphTargetsRelative, a, b, c, modifiedNormal );

						}

					}

				} else {

					start = Math.max( 0, drawRange.start );
					end = Math.min( index.count, drawRange.start + drawRange.count );

					for ( i = start, il = end; i < il; i += 3 ) {

						a = index.getX( i );
						b = index.getX( i + 1 );
						c = index.getX( i + 2 );

						_calculateMorphedAttributeData( object, material, positionAttribute, morphPosition, morphTargetsRelative, a, b, c, modifiedPosition );

						_calculateMorphedAttributeData( object, material, normalAttribute, morphNormal, morphTargetsRelative, a, b, c, modifiedNormal );

					}

				}

			} else if ( positionAttribute !== undefined ) {

				// non-indexed buffer geometry
				if ( Array.isArray( material ) ) {

					for ( i = 0, il = groups.length; i < il; i ++ ) {

						group = groups[ i ];
						groupMaterial = material[ group.materialIndex ];
						start = Math.max( group.start, drawRange.start );
						end = Math.min( group.start + group.count, drawRange.start + drawRange.count );

						for ( j = start, jl = end; j < jl; j += 3 ) {

							a = j;
							b = j + 1;
							c = j + 2;

							_calculateMorphedAttributeData( object, groupMaterial, positionAttribute, morphPosition, morphTargetsRelative, a, b, c, modifiedPosition );

							_calculateMorphedAttributeData( object, groupMaterial, normalAttribute, morphNormal, morphTargetsRelative, a, b, c, modifiedNormal );

						}

					}

				} else {

					start = Math.max( 0, drawRange.start );
					end = Math.min( positionAttribute.count, drawRange.start + drawRange.count );

					for ( i = start, il = end; i < il; i += 3 ) {

						a = i;
						b = i + 1;
						c = i + 2;

						_calculateMorphedAttributeData( object, material, positionAttribute, morphPosition, morphTargetsRelative, a, b, c, modifiedPosition );

						_calculateMorphedAttributeData( object, material, normalAttribute, morphNormal, morphTargetsRelative, a, b, c, modifiedNormal );

					}

				}

			}

			const morphedPositionAttribute = new THREE.Float32BufferAttribute( modifiedPosition, 3 );
			const morphedNormalAttribute = new THREE.Float32BufferAttribute( modifiedNormal, 3 );
			return {
				positionAttribute: positionAttribute,
				normalAttribute: normalAttribute,
				morphedPositionAttribute: morphedPositionAttribute,
				morphedNormalAttribute: morphedNormalAttribute
			};

		}

	}

	THREE.BufferGeometryUtils = BufferGeometryUtils;

} )();
