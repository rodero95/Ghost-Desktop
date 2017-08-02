import DS from 'ember-data';
import getIconColor from '../utils/color-picker';
import requireKeytar from '../utils/require-keytar';
import getBlogName from '../utils/get-blog-name';

const {Model, attr} = DS;
const debug = requireNode('debug')('ghost-desktop:blog-model');

export default Model.extend({
    index: attr('number', {
        defaultValue: 0
    }),
    name: attr('string'),
    url: attr('string'),
    identification: attr('string'),
    isSelected: attr('boolean'),
    iconColor: attr('string', {
        defaultValue: () => getIconColor(null)
    }),
    basicUsername: attr('string'),
    basicPassword: attr('string'),
    isResetRequested: attr('boolean'),

    /**
     * Convenience method, marking the blog as selected (and saving)
     */
    select() {
        if (this.isDestroying || this.isDestroyed || this.get('isDeleted')) {
            return;
        }

        this.set('isSelected', true);
        this.save();
    },

    /**
     * Convenience method, marking the blog as unselected (and saving)
     */
    unselect() {
        if (this.isDestroying || this.isDestroyed || this.get('isDeleted')) {
            return;
        }

        this.set('isSelected', false);
        this.save();
    },

    /**
     * Convenience method, generates a nice icon color for this blog.
     */
    randomIconColor(excluding = null) {
        const newColor = getIconColor(excluding);

        if (newColor === this.get('iconColor')) {
            return this.randomIconColor(excluding);
        } else {
            this.set('iconColor', newColor);
        }
    },

    /**
     * Uses the operating system's native credential store to set the password
     * for this blog.
     *
     * @param {string} value - Password to set
     * @return {Promise<void>} - Success
     */
    setPassword(value) {
        return new Promise((resolve) => {
            const keytar = requireKeytar();

            if (keytar) {
                return keytar.replacePassword(this.get('url'), this.get('identification'), value);
            } else {
                resolve();
            }
        });
    },

    /**
     * Uses the operating system's native credential store to get the password
     * for this blog.
     *
     * @return {Promise<string>} Password for this blog
     */
    getPassword() {
        return new Promise((resolve) => {
            if (!this.get('url') || !this.get('identification')) {
                resolve(null);
            }

            const keytar = requireKeytar();

            if (keytar) {
                return keytar.getPassword(this.get('url'), this.get('identification'));
            } else {
                resolve(null);
            }
        });
    },

    /**
     * Updates this blog's name by attempting to fetch the blog homepage
     * and extracting the name
     */
    updateName() {
        const url = this.get('url');

        if (url) {
            return getBlogName(url)
                .then((name) => {
                    this.set('name', name);
                })
                .catch((e) => debug(`Tried to update blog name, but failed: ${e}`));
        }
    },

    /**
     * Delete the password while deleting the blog.
     * Todo: DeleteRecord isn't persisted, meaning that if we ever
     * call this and then pretend that we never meant to delete stuff,
     * the password will still be gone.
     */
    deleteRecord() {
        this._super();

        const keytar = requireKeytar();
        return (keytar ? keytar.deletePassword(this.get('url'), this.get('identification')) : null);
    },

    /**
     * Whenever a blog is updated, we also inform the main thread
     * - just to ensure that the thread there knows about blogs
     * too.
     */
    save() {
        const {ipcRenderer} = requireNode('electron');
        const serializedData = this.toJSON({includeId: true});

        ipcRenderer.send('blog-serialized', serializedData);
        return this._super(...arguments);
    }
});
