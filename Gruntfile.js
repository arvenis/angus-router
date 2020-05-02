module.exports = function(grunt) {
  let router_pkg = grunt.file.readJSON('src/package.json');
  let routerFilename = 'router-' + router_pkg.version + '.tgz';

  grunt.initConfig({
    tslint: {
      options: {
        configuration: '../tslint.json',
        project: '../tsconfig.json'
      },
      default: { files: { src: ['src/**/*.ts'] } },
      fix: { files: { src: ['src/**/*.ts'] }, options: { fix: true } }
    },
    ts: {
      default: {
        outDir: 'dist',
        src: [
          'src/modules/**/*.ts',
          'src/*.ts'
        ],
        options: {
          target: 'es6',
          lib: ['es7', 'esnext.asynciterable'],
          typeRoots: ['node_modules/@types'],
          moduleResolution: 'node',
          rootDir: 'src',
          module: 'commonjs',
          declaration: false,
          sourceMap: false,
          esModuleInterop: true
        }
      }
    },
    run: {
      test: {
        cmd: 'node_modules/.bin/jest',
        args: ['-c', '../jest.config.js', '-u', 'test', '--runInBand']
      },
      dockerize: {
        cmd: 'docker',
        args: ['build', '-t', 'angus/router', '.', '--build-arg', 'routerFilename=' + routerFilename]
      },
      generate: {
        options: {
          cwd: '..'
        },
        cmd: './generateInterfaces.sh',
        args:[
          "common/fabric-components.yaml",
          "router/src",
          "router/src/config/"
        ] 
      }
    },
    copy: {
      gatewayConfig: {
        files: [
          { expand: true, cwd: 'src/', src: 'config/**', dest: 'dist/' },
          { expand: true, cwd: 'src/', src: 'package.json', dest: 'dist/' },
          { expand: true, cwd: 'src/', src: 'common/**/*.yaml', dest: 'dist/' }
        ]
      },
      package: {
        files: [{ expand: true, cwd: 'dist', src: ['**'], dest: 'artifacts' }]
      }
    },
    compress: {
      package: {
        options: {
          archive: 'artifacts/' + routerFilename,
          mode: 'tgz'
        },
        files: [{ expand: true, cwd: 'dist', src: '**/*' }]
      }
    }
  });

  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-tslint');
  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-contrib-compress');

  // Gateway tasks
  grunt.registerTask('lint', 'Lint router components', ['tslint:default']);
  grunt.registerTask('test', 'Test router components', ['run:test']);
  grunt.registerTask('generate', 'Generate interfaces from OpenAPI definition', ['run:generate']);
  grunt.registerTask('build', 'Build router components', ['ts', 'copy:gatewayConfig']);

  grunt.registerTask('package', 'Create router package', [
    'copy:package',
    'compress:package',
    'run:dockerize'
  ]);
  
  grunt.registerTask('all', 'Create router artifact from scratch', ['lint', 'test', 'build', 'package']);

  // Default task
  grunt.registerTask('default', 'Build', ['build']);
};
